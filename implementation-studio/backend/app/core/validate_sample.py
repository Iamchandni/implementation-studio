import json
from pathlib import Path
from jsonschema import Draft202012Validator

BASE = Path(__file__).resolve().parents[2]
SCHEMAS = BASE / "schemas"
SAMPLES = BASE / "sample_data" / "sample_json"


def validate_file(instance_path: Path, schema_path: Path) -> list[str]:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    instance = json.loads(instance_path.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    instances = instance if isinstance(instance, list) else [instance]
    messages = []
    for index, item in enumerate(instances):
        errors = sorted(validator.iter_errors(item), key=lambda e: list(e.absolute_path))
        for error in errors:
            location = ".".join(str(part) for part in error.absolute_path) or "<root>"
            prefix = f"item[{index}]." if isinstance(instance, list) else ""
            messages.append(f"{prefix}{location}: {error.message}")
    return messages


def main():
    cases = [
        ("requirement", SAMPLES / "requirement_age.json", SCHEMAS / "requirements" / "requirement.schema.json"),
        ("parameter artefact", SAMPLES / "artefact_parameter.json", SCHEMAS / "artefacts" / "parameter.schema.json"),
        ("business rule artefact", SAMPLES / "artefact_business_rule.json", SCHEMAS / "artefacts" / "business_rule.schema.json"),
        ("workflow artefact", SAMPLES / "artefact_workflow.json", SCHEMAS / "artefacts" / "workflow.schema.json"),
    ]

    failed = False
    for label, instance_path, schema_path in cases:
        errors = validate_file(instance_path, schema_path)
        if errors:
            failed = True
            print(f"FAIL: {label}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"PASS: {label}")

    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
