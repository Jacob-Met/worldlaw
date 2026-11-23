"""Verify original method/data boundaries and recalculate the eight gas-state factors."""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE_SHA = "8cb64851c61ab7a849b01a15e5e863ba3815abeebfe5b7cab070c4f3dc41d51c"
HEOS_SHA = "d168b0b24914130581d15ebc6d726e97616478079e2c724a90bafa661f6dc489"


def checked(name, length, digest):
    data = (ROOT / name).read_bytes()
    if len(data) != length or hashlib.sha256(data).hexdigest() != digest:
        raise ValueError(f"Original output identity mismatch for {name}")
    return data.decode("utf-8")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    methods = checked("source-methods-original.txt", 1871, SOURCE_SHA)
    original = checked("modern-heos-original.jsonl", 4938, HEOS_SHA)
    custody = json.loads((ROOT / "source-custody.json").read_text())
    source = json.loads(methods.splitlines()[0])
    require(source["method_deck_sha256"] == custody["deck_sha256"], "Wrong handout")
    require(source["method_slides"] == [3, 4, 5, 6, 7] and source["outcome_slides_opened"] == 0,
            "Unexpected slide scope")
    require("[den [sSub 𝑍[sub 𝑑]]𝐴]" in source["slide7_equations"][0], "Downstream factor missing")
    require(methods.endswith("urllib.error.HTTPError: HTTP Error 403: Forbidden\n"), "Source outcome changed")
    records = [json.loads(line) for line in original.splitlines()]
    require(records[0]["sha256"] == "e88ef42e81b42e42fdd3bd5b8dc541c729e16cf104f08f7a7a8ed354f65fa418",
            "Incorrect wheel")
    expected = [(gas, p) for gas in ("Helium", "Methane") for p in (1, 5, 10, 20)]
    states = records[2:-1]
    require([(r["gas"], r["pressure_MPa"]) for r in states] == expected, "Unexpected gas or pressure roster")
    require(records[-1]["qualified_reference_states"] == 8 and records[-1]["RaSSCAL_rows_read"] == 0,
            "Wrong reference scope")
    require(custody["earlier_call_refusal"]["provider_dispatch"] == "not_attempted", "First dispatch outcome")
    for evidence, (code, size) in zip(custody["native_originals"], ((1, 1871), (0, 4938)), strict=True):
        receipt = evidence["terminal_receipt"]
        require(receipt["exit_code"] == code and evidence["stdout_bytes"] == size, "Wrong original terminal")
        require(receipt["resource_usage"]["descendant_wait"]["state"] == "drained", "Undrained original")
        require(receipt["generation"] == evidence["generation"]
                and receipt["request_sha256"] == evidence["command_request_sha256"], "Original binding")
    max_error = 0.0
    result = {}
    for state in states:
        require(state["temperature_K"] == 300, "Temperature changed")
        rho = state["density_kg_m3"]
        speed = state["sound_m_s"]
        pressure = state["pressure_MPa"] * 1e6
        kappa = state["cp_J_kg_K"] / (state["cv_J_kg_K"] * rho * speed**2)
        storage = pressure * kappa
        require(math.isclose(kappa, state["isothermal_compressibility_Pa_inv"], rel_tol=1e-8),
                "Modern HEOS compressibility mismatch")
        require(math.isclose(storage, state["storage_Pkappa"], rel_tol=1e-14) and
                math.isclose(1 / storage, state["exact_mass_balance_over_2018_slide_pressure_slope"], rel_tol=1e-14),
                "Reciprocal or unit mismatch")
        errors = state["central_difference_relative_error_0p1_then_0p05_MPa"]
        require(len(errors) == 2 and all(0 <= x < 1 for x in errors) and errors[1] < 2e-4,
                "Finite-difference gate")
        max_error = max(max_error, errors[1])
        result.setdefault(state["gas"], []).append(1 / storage)
    print(json.dumps({"slope_ratios_exact_over_slide": result, "max_narrow_difference_error": max_error,
                      "model_states": len(states), "rock_observations_scored": 0}, sort_keys=True))


if __name__ == "__main__":
    main()
