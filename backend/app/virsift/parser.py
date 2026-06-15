"""GISAID-optimized FASTA parser — ported from VirSift.

Handles 4 header variants:
  1. v1.0 Normalized (9 fields)
  2. Standard GISAID human/B (6 fields, subtype before segment)
  3. GISAID avian batch (6 fields, segment before subtype)
  4. hRSV / 3-field short format

Streamlit dependencies removed. Pure pandas/hashlib.
"""

import gzip
import hashlib
import io
import re
import time
import zipfile

import pandas as pd

_HXNX_RE = re.compile(r"(H\d+N\d+)")

_KNOWN_SEGMENTS = frozenset({
    "HA", "NA", "PB1", "PB2", "PA", "NP", "MP", "NS",
    "HE", "P3", "M1", "M2", "NEP", "NS1", "NS2",
})

_FAST_DATE_FMT = "%Y-%m-%d"
_SLOW_DATE_FMTS = ("%Y-%m", "%Y", "%d-%b-%Y", "%b-%Y", "%b-%d-%Y", "%Y%m%d")
_DATE_NULL_SET = frozenset(("", "Unknown", "unknown", "N/A", "NA", "None", "none"))

# ── Latin genus lookup tables ──

_AVIAN_GENERA: frozenset = frozenset({
    "anas", "aythya", "bucephala", "clangula", "mergus", "mergellus",
    "oxyura", "netta", "marmaronetta", "spatula",
    "anser", "branta", "chen", "cygnus", "coscoroba",
    "pelecanus", "phalacrocorax", "morus", "sula", "fregata",
    "ardea", "egretta", "bubulcus", "nycticorax", "ciconia", "mycteria",
    "threskiornis", "plegadis", "platalea",
    "calidris", "tringa", "charadrius", "pluvialis", "limosa", "numenius",
    "gallinago", "scolopax", "recurvirostra", "haematopus", "vanellus",
    "phalaropus", "philomachus", "actitis", "arenaria",
    "larus", "chroicocephalus", "leucophaeus", "sterna", "thalasseus",
    "anous", "catharacta", "stercorarius", "fratercula", "alca",
    "uria", "cepphus", "alle",
    "puffinus", "calonectris", "fulmarus", "oceanodroma", "diomedea",
    "thalassarche", "macronectes",
    "gallus", "meleagris", "coturnix", "phasianus", "numida",
    "perdix", "alectoris", "colinus", "callipepla", "lophura",
    "chrysolophus", "polyplectron", "afropavo", "pavo",
    "fulica", "gallinula", "rallus", "crex", "porzana", "grus",
    "balearica", "anthropoides",
    "columba", "streptopelia", "zenaida", "geopelia",
    "passer", "sturnus", "corvus", "pica", "pyrrhocorax", "turdus",
    "erithacus", "fringilla", "emberiza", "hirundo", "delichon",
    "ficedula", "sylvia", "phylloscopus", "acrocephalus",
    "accipiter", "buteo", "aquila", "hieraaetus", "haliaeetus",
    "pandion", "milvus", "circus", "elanus", "falco",
    "strix", "bubo", "asio", "tyto", "athene",
    "spheniscus", "pygoscelis", "aptenodytes", "eudyptes",
    "struthio", "dromaius", "rhea", "casuarius",
})

_MAMMAL_GENERA: frozenset = frozenset({
    "sus",
    "mustela", "neovison", "neogale", "lutra", "meles",
    "halichoerus", "phoca", "mirounga", "zalophus", "arctocephalus",
    "felis", "panthera", "neofelis", "prionailurus",
    "canis", "vulpes", "nyctereutes",
    "equus",
    "rhinolophus", "pteropus", "tadarida", "myotis", "pipistrellus",
    "miniopterus", "hipposideros", "cynopterus",
    "balaena", "tursiops", "delphinus", "phocoena", "orcinus",
    "megaptera", "balaenoptera",
    "bos", "bubalus", "ovis", "capra", "cervus", "alces", "odocoileus",
    "rangifer", "camelus", "lama",
    "viverra", "civettictis", "herpestes",
    "procyon",
    "oryctolagus", "lepus",
})

_AVIAN_KW: frozenset = frozenset({
    "duck", "mallard", "pintail", "teal", "wigeon", "shoveler", "gadwall",
    "pochard", "scaup", "eider", "goldeneye", "bufflehead", "canvasback",
    "redhead", "smew", "merganser",
    "goose", "brant", "barnacle", "greylag", "swan", "whooper",
    "pelican", "cormorant", "gannet", "booby", "frigatebird",
    "egret", "heron", "bittern", "ibis", "spoonbill", "stork", "crane",
    "gull", "tern", "skua", "puffin", "guillemot", "razorbill", "auk",
    "petrel", "shearwater", "albatross", "fulmar", "penguin",
    "plover", "sandpiper", "dunlin", "knot", "turnstone", "curlew", "godwit",
    "whimbrel", "snipe", "woodcock", "avocet", "oystercatcher", "lapwing",
    "redshank", "greenshank", "phalarope", "stint", "ruff", "dowitcher",
    "chicken", "hen", "broiler", "layer", "turkey", "quail", "pheasant",
    "partridge", "grouse", "peafowl", "chukar", "junglefowl",
    "ostrich", "emu", "cassowary", "rhea",
    "coot", "moorhen", "rail", "crake", "gallinule",
    "pigeon", "dove",
    "sparrow", "starling", "crow", "magpie", "raven", "rook", "jackdaw",
    "finch", "warbler", "swift", "martin", "swallow",
    "hawk", "eagle", "falcon", "owl", "kite", "harrier", "buzzard",
    "kestrel", "vulture", "osprey",
    "bird", "avian", "poultry", "waterfowl", "shorebird",
    "wader", "seabird", "passerine", "raptor", "fowl",
    "domestic", "wild",
})

_MAMMAL_KW: frozenset = frozenset({
    "swine", "pig", "boar", "pork",
    "ferret", "mink", "otter", "badger",
    "seal", "sealion",
    "cat", "feline", "tiger", "leopard", "lion",
    "dog", "canine", "fox", "raccoon",
    "horse", "equine",
    "bat",
    "whale", "dolphin", "porpoise",
    "bovine", "cattle", "cow", "bull", "calf",
    "sheep", "ovine", "goat", "deer", "elk", "moose", "rabbit",
    "mongoose", "civet",
})

_SPECIES_COMMON_NAMES: dict = {
    "Anas_platyrhynchos": "mallard", "Anas_crecca": "common_teal",
    "Anas_carolinensis": "green-winged_teal", "Anas_strepera": "gadwall",
    "Anas_acuta": "pintail", "Anas_clypeata": "shoveler",
    "Anas_querquedula": "garganey", "Anas_penelope": "wigeon",
    "Anas_americana": "American_wigeon", "Anas_discors": "blue-winged_teal",
    "Anas_formosa": "Baikal_teal", "Anas_poecilorhyncha": "spot-billed_duck",
    "Anas_falcata": "falcated_duck",
    "Aythya_ferina": "pochard", "Aythya_fuligula": "tufted_duck",
    "Aythya_marila": "scaup", "Aythya_nyroca": "ferruginous_duck",
    "Anser_anser": "greylag_goose", "Anser_fabalis": "bean_goose",
    "Anser_albifrons": "white-fronted_goose", "Anser_brachyrhynchus": "pink-footed_goose",
    "Anser_caerulescens": "snow_goose",
    "Branta_canadensis": "Canada_goose", "Branta_bernicla": "brent_goose",
    "Branta_leucopsis": "barnacle_goose",
    "Mergus_merganser": "merganser", "Mergus_serrator": "red-breasted_merganser",
    "Cygnus_olor": "mute_swan", "Cygnus_cygnus": "whooper_swan",
    "Cygnus_columbianus": "Bewick_swan",
    "Podiceps_cristatus": "great_crested_grebe", "Podiceps_grisegena": "red-necked_grebe",
    "Podiceps_auritus": "Slavonian_grebe",
    "Corvus_frugilegus": "rook", "Corvus_corax": "raven", "Corvus_corone": "carrion_crow",
    "Gallus_gallus": "chicken", "Meleagris_gallopavo": "turkey",
    "Coturnix_coturnix": "quail", "Coturnix_japonica": "Japanese_quail",
    "Phasianus_colchicus": "pheasant", "Numida_meleagris": "guinea_fowl",
    "Columba_livia": "pigeon",
    "Ardea_cinerea": "grey_heron", "Nycticorax_nycticorax": "night_heron",
    "Sus_scrofa": "pig", "Equus_caballus": "horse",
    "Felis_catus": "cat", "Canis_lupus": "dog",
    "Mustela_vison": "mink", "Neovison_vison": "mink",
    "Halichoerus_grypus": "grey_seal", "Phoca_vitulina": "harbour_seal",
    "Phoca_largha": "spotted_seal", "Odobenus_rosmarus": "walrus",
}


# ── Public API ──

def parse_gisaid_fasta(file_content: str, file_name: str) -> tuple:
    sequences = []
    parsing_start = time.perf_counter()

    current_header = None
    current_seq_parts = []

    for line in file_content.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith(">"):
            if current_header is not None:
                seq = "".join(current_seq_parts).upper().replace(" ", "").replace("-", "")
                metadata = _parse_header(current_header)
                metadata["sequence"] = seq
                metadata["sequence_length"] = len(seq)
                metadata["sequence_hash"] = _compute_sequence_hash(seq)
                sequences.append(metadata)
            current_header = line[1:]
            current_seq_parts = []
        else:
            current_seq_parts.append(line)

    if current_header is not None:
        seq = "".join(current_seq_parts).upper().replace(" ", "").replace("-", "")
        metadata = _parse_header(current_header)
        metadata["sequence"] = seq
        metadata["sequence_length"] = len(seq)
        metadata["sequence_hash"] = _compute_sequence_hash(seq)
        sequences.append(metadata)

    if sequences:
        raw_dates = [s.pop("_raw_date", "") for s in sequences]
        parsed_dates = _batch_parse_dates(raw_dates)
        for s, d in zip(sequences, parsed_dates):
            s["collection_date"] = d

    parsing_time = time.perf_counter() - parsing_start
    return sequences, parsing_time


def decompress_if_needed(raw_bytes: bytes, file_name: str, max_decompressed: int = 200 * 1024 * 1024) -> str:
    import os as _os
    name_lower = file_name.lower()
    try:
        if name_lower.endswith(".gz"):
            decompressed = gzip.decompress(raw_bytes)
            if len(decompressed) > max_decompressed:
                raise ValueError(f"Decompressed size ({len(decompressed)}) exceeds limit ({max_decompressed})")
            return decompressed.decode("utf-8", errors="replace")
        if name_lower.endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
                total_size = sum(info.file_size for info in zf.infolist())
                if total_size > max_decompressed:
                    raise ValueError(f"Archive total size ({total_size}) exceeds limit ({max_decompressed})")
                fasta_exts = (".fasta", ".fa", ".fas", ".fna", ".txt", ".aln-fasta")
                fasta_members = sorted([
                    m for m in zf.namelist()
                    if m.lower().endswith(fasta_exts)
                    and not m.startswith("__MACOSX")
                    and not _os.path.basename(m).startswith(".")
                ])
                if fasta_members:
                    parts: list[str] = []
                    for member in fasta_members:
                        with zf.open(member) as f:
                            parts.append(f.read().decode("utf-8", errors="replace"))
                    return "\n".join(parts)
                if zf.namelist():
                    with zf.open(zf.namelist()[0]) as f:
                        return f.read().decode("utf-8", errors="replace")
    except ValueError:
        raise
    except Exception:
        pass
    if len(raw_bytes) > max_decompressed:
        raise ValueError(f"File size ({len(raw_bytes)}) exceeds limit ({max_decompressed})")
    return raw_bytes.decode("utf-8", errors="replace")


def convert_df_to_fasta(df: pd.DataFrame) -> str:
    if df.empty:
        return ""

    def _col(name: str, fallback: str = "Unknown") -> pd.Series:
        if name in df.columns:
            return df[name].fillna(fallback).astype(str)
        return pd.Series([fallback] * len(df), index=df.index)

    if "collection_date" in df.columns:
        date_col = pd.to_datetime(df["collection_date"], errors="coerce")
        date_str = date_col.dt.strftime("%Y-%m-%d").fillna("Unknown")
    else:
        date_str = pd.Series(["Unknown"] * len(df), index=df.index)

    headers = (
        ">"
        + _col("isolate") + "|"
        + _col("subtype") + "|"
        + _col("segment") + "|"
        + date_str + "|"
        + _col("accession") + "|"
        + _col("clade")
    )
    sequences = _col("sequence", "")

    return (headers + "\n" + sequences).str.cat(sep="\n")


def infer_host_from_isolate(isolate_name: str) -> str:
    if not isolate_name:
        return "Unknown"
    name_lower = isolate_name.lower()
    if "/environment/" in name_lower:
        return "Environment"
    if name_lower.startswith(("hrsv/", "rsv/", "mers-cov/", "sars-cov/")):
        return "Human"

    _slash_parts = isolate_name.split("/")
    _n = len(_slash_parts)
    _is_flu_AB = isolate_name.startswith("A/") or isolate_name.startswith("B/")

    if _is_flu_AB:
        for _pos in (1, 2):
            if _pos < _n:
                _r = _classify_isolate_part(_slash_parts[_pos])
                if _r:
                    return _r
        if _n >= 5:
            return "Avian"
        return "Human"

    _legacy_avian = [
        "duck", "mallard", "pintail", "teal", "wigeon", "shoveler", "gadwall",
        "pochard", "scaup", "eider", "goldeneye", "bufflehead", "canvasback",
        "redhead", "smew", "merganser", "ruddy duck",
        "goose", "brant", "barnacle", "greylag", "snow goose", "canada goose",
        "bean goose", "white-fronted goose", "swan", "whooper", "mute swan",
        "pelican", "cormorant", "gannet", "booby", "frigatebird",
        "egret", "heron", "bittern", "ibis", "spoonbill", "stork", "crane",
        "gull", "tern", "skua", "puffin", "guillemot", "razorbill", "auk",
        "petrel", "shearwater", "albatross", "fulmar", "penguin",
        "plover", "sandpiper", "dunlin", "knot", "turnstone", "curlew", "godwit",
        "whimbrel", "snipe", "woodcock", "avocet", "oystercatcher", "lapwing",
        "redshank", "greenshank", "phalarope", "stint", "ruff", "dowitcher",
        "yellowlegs", "chicken", "hen", "broiler", "layer", "turkey", "quail",
        "pheasant", "partridge", "grouse", "guinea fowl", "peafowl", "chukar",
        "junglefowl", "ostrich", "emu", "cassowary", "rhea",
        "coot", "moorhen", "rail", "crake", "gallinule",
        "pigeon", "dove",
        "sparrow", "starling", "crow", "magpie", "raven", "rook", "jackdaw",
        "finch", "bunting", "thrush", "blackbird", "robin", "warbler",
        "swift", "martin", "swallow",
        "hawk", "eagle", "falcon", "owl", "kite", "harrier", "buzzard",
        "kestrel", "vulture", "osprey",
        "wild bird", "avian", "bird", "poultry", "waterfowl", "shorebird",
        "wader", "seabird", "passerine", "raptor", "fowl", "gallinaceous",
    ]
    if any(k in name_lower for k in _legacy_avian):
        return "Avian"
    _legacy_mammal = [
        "swine", "pig", "ferret", "mink", "seal", "sea lion", "walrus",
        "cat", "dog", "horse", "tiger", "leopard", "lion", "bear",
        "bat", "fox", "raccoon", "otter", "badger", "mongoose", "civet",
        "whale", "dolphin", "porpoise", "bovine", "cattle", "cow",
        "sheep", "goat", "deer", "elk", "moose", "rabbit", "rodent",
    ]
    if any(k in name_lower for k in _legacy_mammal):
        return "Mammalian"

    return "Unknown"


def extract_location_from_isolate(isolate_name: str) -> str:
    if not isolate_name:
        return "Unknown"
    parts = [p.strip() for p in isolate_name.split("/") if p.strip()]
    n = len(parts)
    _is_flu_AB = isolate_name.startswith("A/") or isolate_name.startswith("B/")

    if _is_flu_AB and n >= 5:
        return parts[2]
    if _is_flu_AB and n == 4:
        return parts[1]

    _always_skip = frozenset({"a", "b", "hrsv", "rsv", "mers-cov", "sars-cov", "environment"})
    for part in parts:
        p_low = part.lower()
        if p_low in _always_skip:
            continue
        if _classify_isolate_part(part) is not None:
            continue
        return part

    return parts[1] if n > 1 else "Unknown"


# ── Internal helpers ──

def _compute_sequence_hash(sequence: str) -> str:
    return hashlib.md5(sequence.upper().encode()).hexdigest()[:12]


def _classify_isolate_part(part: str) -> str | None:
    p = part.lower().strip()
    if not p:
        return None
    words = p.replace("-", "_").split("_")
    genus = words[0]

    if genus in _AVIAN_GENERA:
        return "Avian"
    if genus in _MAMMAL_GENERA:
        return "Mammalian"

    for w in words:
        if w in _AVIAN_KW:
            return "Avian"
        if w in _MAMMAL_KW:
            return "Mammalian"

    return None


def _extract_host_species(isolate_name: str) -> str:
    if not isolate_name:
        return "Unknown"
    _skip = frozenset({"a", "b", "hrsv", "rsv", "mers-cov", "sars-cov", "environment"})
    parts = [p.strip() for p in isolate_name.split("/") if p.strip()]
    n = len(parts)
    _is_flu_AB = isolate_name.startswith("A/") or isolate_name.startswith("B/")

    if _is_flu_AB and n >= 5:
        token = parts[1]
        raw = token if token.lower() not in _skip else "Unknown"
        return _SPECIES_COMMON_NAMES.get(raw, raw)

    if _is_flu_AB and n == 4:
        return "Unknown"

    for part in parts:
        if not part or part.lower() in _skip:
            continue
        if _classify_isolate_part(part) is not None:
            raw = part
            return _SPECIES_COMMON_NAMES.get(raw, raw)
    return "Unknown"


def _batch_parse_dates(date_strings: list) -> list:
    if not date_strings:
        return []

    s = pd.Series(date_strings, dtype=str)
    fast = pd.to_datetime(s, format=_FAST_DATE_FMT, errors="coerce")

    null_mask = fast.isna()
    if null_mask.any():
        for raw, idx in zip(s[null_mask], s[null_mask].index):
            raw = raw.strip() if isinstance(raw, str) else ""
            if raw in _DATE_NULL_SET:
                continue
            for fmt in _SLOW_DATE_FMTS:
                try:
                    fast.iloc[idx] = pd.to_datetime(raw, format=fmt)
                    break
                except (ValueError, TypeError):
                    continue
            else:
                try:
                    fast.iloc[idx] = pd.to_datetime(raw)
                except Exception:
                    pass

    return [None if pd.isna(v) else v for v in fast]


def _parse_header(header: str) -> dict:
    parts = [p.strip() for p in header.split("|")]
    n = len(parts)

    if n >= 9:
        _v1_host = parts[5] if n > 5 else "Unknown"
        metadata = {
            "isolate": parts[0],
            "subtype": parts[2] if n > 2 else "Unknown",
            "segment": parts[3] if n > 3 else "Unknown",
            "location": parts[4] if n > 4 else "Unknown",
            "host": _v1_host,
            "host_species": _extract_host_species(parts[0]) if _v1_host == "Unknown"
                            else _v1_host,
            "_raw_date": parts[6] if n > 6 else "",
            "clade": parts[7] if n > 7 else "Unknown",
            "accession": parts[8] if n > 8 else "Unknown",
        }
    elif n <= 3:
        raw_isolate = parts[0] if n > 0 else "Unknown"
        metadata = {
            "isolate": raw_isolate,
            "subtype": "Unknown",
            "segment": "Unknown",
            "accession": parts[1] if n > 1 else "Unknown",
            "_raw_date": parts[2] if n > 2 else "",
            "clade": "Unknown",
            "host": infer_host_from_isolate(raw_isolate),
            "host_species": _extract_host_species(raw_isolate),
            "location": extract_location_from_isolate(raw_isolate),
        }
    else:
        raw_isolate = parts[0] if n > 0 else "Unknown"
        p1 = parts[1] if n > 1 else "Unknown"
        p2 = parts[2] if n > 2 else "Unknown"

        if p1.upper() in _KNOWN_SEGMENTS:
            segment = p1
            subtype = p2
        else:
            subtype = p1
            segment = p2

        metadata = {
            "isolate": raw_isolate,
            "subtype": subtype,
            "segment": segment,
            "_raw_date": parts[3] if n > 3 else "",
            "accession": parts[4] if n > 4 else "Unknown",
            "clade": parts[5] if n > 5 else "Unknown",
            "host": infer_host_from_isolate(raw_isolate),
            "host_species": _extract_host_species(raw_isolate),
            "location": extract_location_from_isolate(raw_isolate),
        }

    m = _HXNX_RE.search(metadata["subtype"])
    metadata["subtype_clean"] = m.group(1) if m else metadata["subtype"]

    clade_val = metadata.get("clade") or "Unknown"
    if clade_val not in ("Unknown", "", "None", "none"):
        levels = clade_val.split(".")
        for i in range(6):
            metadata[f"clade_l{i + 1}"] = ".".join(levels[: i + 1]) if i < len(levels) else None
    else:
        for i in range(6):
            metadata[f"clade_l{i + 1}"] = None

    return metadata
