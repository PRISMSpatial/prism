"""SEIR compartmental model — scipy ODE solver + ensemble forecasting."""

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import minimize


class SEIRModel:
    """Susceptible-Exposed-Infectious-Recovered compartmental model.

    Fits to observed weekly incidence, projects forward with ensemble
    uncertainty, and computes R(t) trajectories for fan chart display.
    """

    def __init__(self, population: int = 1_000_000):
        self.N = population

    def _ode(self, t, y, beta, sigma, gamma):
        S, E, I, R = y
        N = self.N
        new_infections = beta * S * I / N
        dS = -new_infections
        dE = new_infections - sigma * E
        dI = sigma * E - gamma * I
        dR = gamma * I
        return [dS, dE, dI, dR]

    def solve(self, beta, sigma, gamma, I0, E0, n_days):
        S0 = self.N - E0 - I0
        y0 = [S0, E0, I0, 0.0]
        t_eval = np.arange(0, n_days, dtype=float)
        sol = solve_ivp(
            self._ode, (0, n_days - 1), y0, t_eval=t_eval,
            args=(beta, sigma, gamma), method="RK23",
        )
        return sol

    def _weekly_incidence(self, sol, sigma):
        E = sol.y[1]
        daily_new = sigma * E
        n_weeks = len(daily_new) // 7
        return np.array([daily_new[w * 7:(w + 1) * 7].sum() for w in range(n_weeks)])

    def _weekly_rt(self, sol, beta, gamma):
        S = sol.y[0]
        rt = beta * S / (gamma * self.N)
        n_weeks = len(rt) // 7
        return np.array([rt[w * 7:(w + 1) * 7].mean() for w in range(n_weeks)])

    def fit(self, observed_weekly: list[float]) -> dict:
        n_obs = len(observed_weekly)
        obs = np.array(observed_weekly, dtype=float)
        obs_log = np.log1p(obs)
        n_days = n_obs * 7

        def objective(x):
            beta = np.exp(x[0])
            sigma = np.exp(x[1])
            gamma = np.exp(x[2])
            I0 = np.exp(x[3]) * self.N
            E0 = np.exp(x[4]) * self.N
            try:
                sol = self.solve(beta, sigma, gamma, I0, E0, n_days)
                if sol.status != 0 or sol.y.shape[1] < n_days:
                    return 1e12
                model = self._weekly_incidence(sol, sigma)[:n_obs]
                if len(model) < n_obs:
                    return 1e12
                model_log = np.log1p(np.maximum(model, 0))
                return float(np.sum((model_log - obs_log) ** 2))
            except Exception:
                return 1e12

        bounds = [
            (np.log(0.05), np.log(3.0)),
            (np.log(1 / 7), np.log(1 / 1.5)),
            (np.log(1 / 14), np.log(1 / 2)),
            (np.log(1e-6), np.log(5e-2)),
            (np.log(1e-6), np.log(5e-2)),
        ]

        starts = [
            [np.log(0.3), np.log(1 / 3), np.log(1 / 5), np.log(1e-4), np.log(2e-4)],
            [np.log(0.5), np.log(1 / 2), np.log(1 / 7), np.log(1e-3), np.log(1e-3)],
            [np.log(0.15), np.log(1 / 4), np.log(1 / 10), np.log(5e-5), np.log(1e-4)],
            [np.log(0.8), np.log(1 / 2.5), np.log(1 / 4), np.log(5e-4), np.log(5e-4)],
        ]

        best_result = None
        best_fun = 1e12
        for x0 in starts:
            try:
                result = minimize(objective, x0, method="L-BFGS-B", bounds=bounds,
                                  options={"maxiter": 5000, "ftol": 1e-12})
                if result.fun < best_fun:
                    best_fun = result.fun
                    best_result = result
            except Exception:
                continue

        if best_result is None:
            raise ValueError("SEIR fitting failed to converge")

        beta = np.exp(best_result.x[0])
        sigma = np.exp(best_result.x[1])
        gamma = np.exp(best_result.x[2])
        I0 = np.exp(best_result.x[3]) * self.N
        E0 = np.exp(best_result.x[4]) * self.N

        return {
            "beta": round(float(beta), 6),
            "sigma": round(float(sigma), 6),
            "gamma": round(float(gamma), 6),
            "R0": round(float(beta / gamma), 3),
            "I0": round(float(I0), 1),
            "E0": round(float(E0), 1),
            "incubation_days": round(1 / sigma, 1),
            "infectious_days": round(1 / gamma, 1),
            "fit_loss": round(float(best_result.fun), 2),
        }

    def project(
        self,
        params: dict,
        n_observed: int,
        horizon: int = 13,
        n_draws: int = 500,
        beta_modifier: float = 1.0,
    ) -> dict:
        total_weeks = n_observed + horizon
        n_days = total_weeks * 7
        beta = params["beta"] * beta_modifier
        sigma, gamma = params["sigma"], params["gamma"]
        I0, E0 = params["I0"], params["E0"]

        rng = np.random.default_rng(42)
        all_rt = []
        all_inc = []

        for draw in range(n_draws):
            if draw == 0:
                b, s, g, i0, e0 = beta, sigma, gamma, I0, E0
            else:
                b = beta * np.exp(rng.normal(0, 0.06))
                s = sigma * np.exp(rng.normal(0, 0.04))
                g = gamma * np.exp(rng.normal(0, 0.04))
                i0 = I0 * np.exp(rng.normal(0, 0.12))
                e0 = E0 * np.exp(rng.normal(0, 0.12))
            try:
                sol = self.solve(b, s, g, max(1.0, i0), max(1.0, e0), n_days)
                if sol.status != 0 or sol.y.shape[1] < n_days:
                    continue
                rt = self._weekly_rt(sol, b, g)[:total_weeks]
                inc = self._weekly_incidence(sol, s)[:total_weeks]
                if len(rt) >= total_weeks:
                    all_rt.append(rt)
                    all_inc.append(inc)
            except Exception:
                continue

        if len(all_rt) < 20:
            raise ValueError(f"Only {len(all_rt)} valid draws — model may be unstable")

        rt_arr = np.array(all_rt)
        inc_arr = np.array(all_inc)

        per100k = 100_000 / self.N

        def quantiles(arr, lo, hi):
            return list(zip(
                np.percentile(arr, lo, axis=0).tolist(),
                np.percentile(arr, hi, axis=0).tolist(),
            ))

        return {
            "rt_median": np.median(rt_arr, axis=0).tolist(),
            "rt_p50": quantiles(rt_arr, 25, 75),
            "rt_p80": quantiles(rt_arr, 10, 90),
            "rt_p95": quantiles(rt_arr, 2.5, 97.5),
            "inc_fit": (np.median(inc_arr, axis=0) * per100k).tolist(),
            "valid_draws": len(all_rt),
        }

    def run_full(
        self,
        observed_weekly: list[float],
        population: int = 1_000_000,
        horizon: int = 13,
        n_draws: int = 500,
    ) -> dict:
        self.N = population
        params = self.fit(observed_weekly)
        n_obs = len(observed_weekly)
        per100k = 100_000 / population

        obs_per100k = [v * per100k for v in observed_weekly]

        baseline = self.project(params, n_obs, horizon, n_draws, beta_modifier=1.0)
        intervention = self.project(params, n_obs, horizon, n_draws, beta_modifier=0.80)
        surge = self.project(params, n_obs, horizon, n_draws, beta_modifier=1.20)

        def build_scenario(proj, obs_list):
            total = n_obs + horizon
            obs_padded = obs_list + [None] * horizon
            return {
                "forecast": {
                    "weeks": total,
                    "median": proj["rt_median"],
                    "p50": proj["rt_p50"],
                    "p80": proj["rt_p80"],
                    "p95": proj["rt_p95"],
                    "now": n_obs - 1,
                },
                "incidence": {
                    "obs": obs_padded[:total],
                    "fit": proj["inc_fit"][:total],
                },
                "peak_incidence": round(max(proj["inc_fit"][n_obs:n_obs + horizon]), 1) if horizon > 0 else 0,
                "peak_week": int(np.argmax(proj["inc_fit"][n_obs:n_obs + horizon]) + n_obs) if horizon > 0 else n_obs,
                "valid_draws": proj["valid_draws"],
            }

        return {
            "params": params,
            "n_observed": n_obs,
            "horizon": horizon,
            "population": population,
            "scenarios": {
                "baseline": build_scenario(baseline, obs_per100k),
                "intervention": build_scenario(intervention, obs_per100k),
                "surge": build_scenario(surge, obs_per100k),
            },
        }
