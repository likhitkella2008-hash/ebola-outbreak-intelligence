import sys
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from http.server import BaseHTTPRequestHandler
import json


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        try:
            days = 180
            population = 100000

            # Initial population compartments
            exposed_initial = 10
            infectious_initial = 5
            recovered_initial = 0
            deaths_initial = 0
            susceptible_initial = (
                population
                - exposed_initial
                - infectious_initial
                - recovered_initial
                - deaths_initial
            )

            # Illustrative SEIRD parameters
            beta = 0.20
            sigma = 1 / 9
            gamma = 1 / 14
            mu = 0.02

            def model(t, y):
                S, E, I, R, D = y

                infection = beta * S * I / population

                dS = -infection
                dE = infection - sigma * E
                dI = sigma * E - (gamma + mu) * I
                dR = gamma * I
                dD = mu * I

                return [dS, dE, dI, dR, dD]

            initial_conditions = [
                susceptible_initial,
                exposed_initial,
                infectious_initial,
                recovered_initial,
                deaths_initial,
            ]

            solution = solve_ivp(
                model,
                (0, days),
                initial_conditions,
                t_eval=np.arange(days + 1),
                method="RK45",
            )

            if not solution.success:
                raise RuntimeError("ODE simulation failed.")

            result = {
                "time": solution.t.tolist(),
                "susceptible": solution.y[0].tolist(),
                "exposed": solution.y[1].tolist(),
                "infectious": solution.y[2].tolist(),
                "recovered": solution.y[3].tolist(),
                "deaths": solution.y[4].tolist(),
                "model_type": "Illustrative SEIRD",
                "warning": (
                    "Illustrative simulation only. "
                    "Parameters are not calibrated to the supplied dataset."
                ),
            }

            body = json.dumps(result).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        except Exception as error:
            body = json.dumps({"error": str(error)}).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)