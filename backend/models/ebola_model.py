"""
SEIRD mathematical model for Ebola transmission.

S: Susceptible
E: Exposed
I: Infectious
R: Recovered
D: Deaths due to disease

This is an illustrative mathematical model, not a validated
clinical forecasting system.
"""

import numpy as np
from scipy.integrate import solve_ivp


def seird_model(t, y, beta, sigma, gamma, mu, population):
    """Define the coupled SEIRD differential equations."""

    S, E, I, R, D = y

    # Avoid division by zero
    if population <= 0:
        raise ValueError("Population must be positive.")

    # Force of infection
    infection = beta * S * I / population

    # Differential equations
    dS = -infection
    dE = infection - sigma * E
    dI = sigma * E - (gamma + mu) * I
    dR = gamma * I
    dD = mu * I

    return [dS, dE, dI, dR, dD]


def simulate_seird(
    population=100_000,
    exposed_initial=10,
    infectious_initial=5,
    recovered_initial=0,
    deaths_initial=0,
    beta=0.20,
    sigma=1 / 9,
    gamma=1 / 14,
    mu=0.02,
    days=180,
):
    """
    Simulate the illustrative SEIRD model.

    Parameters are example values for testing the software.
    They are not fitted or validated Ebola parameters.
    """

    values = [
        population,
        exposed_initial,
        infectious_initial,
        recovered_initial,
        deaths_initial,
        beta,
        sigma,
        gamma,
        mu,
        days,
    ]

    if not all(np.isfinite(v) for v in values):
        raise ValueError("All inputs must be finite numbers.")

    if population <= 0 or days <= 0:
        raise ValueError("Population and days must be positive.")

    if min(
        exposed_initial,
        infectious_initial,
        recovered_initial,
        deaths_initial,
        beta,
        sigma,
        gamma,
        mu,
    ) < 0:
        raise ValueError("Initial values and rates cannot be negative.")

    initially_accounted = (
        exposed_initial
        + infectious_initial
        + recovered_initial
        + deaths_initial
    )

    if initially_accounted > population:
        raise ValueError(
            "Initial compartments cannot exceed the population."
        )

    susceptible_initial = population - initially_accounted

    initial_state = [
        susceptible_initial,
        exposed_initial,
        infectious_initial,
        recovered_initial,
        deaths_initial,
    ]

    time_points = np.linspace(0, days, int(days) + 1)

    solution = solve_ivp(
        fun=lambda t, y: seird_model(
            t, y, beta, sigma, gamma, mu, population
        ),
        t_span=(0, days),
        y0=initial_state,
        t_eval=time_points,
        method="RK45",
        rtol=1e-7,
        atol=1e-9,
    )

    if not solution.success:
        raise RuntimeError(
            f"ODE simulation failed: {solution.message}"
        )

    # Small numerical errors can produce tiny negative values.
    results = np.maximum(solution.y.T, 0.0)

    return {
        "time": solution.t.tolist(),
        "susceptible": results[:, 0].tolist(),
        "exposed": results[:, 1].tolist(),
        "infectious": results[:, 2].tolist(),
        "recovered": results[:, 3].tolist(),
        "deaths": results[:, 4].tolist(),
        "parameters": {
            "beta": beta,
            "sigma": sigma,
            "gamma": gamma,
            "mu": mu,
            "population": population,
            "days": days,
        },
        "model_type": "illustrative_SEIRD",
        "warning": (
            "Illustrative simulation only. Parameters have not "
            "been fitted to or validated against the supplied dataset."
        ),
    }