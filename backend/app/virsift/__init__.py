"""VirSift — Pre-phylogenetic FASTA sequence curation engine.

Ported from SpatialOmicsLab/VirSift. Algorithms:
  - GISAID 4-variant header parser with host inference
  - Vectorized boolean mask filter engine (8 operators)
  - Adaptive biological sampler (Micro/Seasonal/Endemic)
  - Epidemic wave detector (scipy peak/trough + off-season clusters)
"""
