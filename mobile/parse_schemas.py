import json
import os

with open(r"C:\Users\Aditya Pathak\.gemini\antigravity-ide\brain\fe8adf1c-5e28-4733-b030-9c8cc44c28ea\.system_generated\steps\235\content.md", "r", encoding="utf-8") as f:
    # Read line 5 which contains the json
    lines = f.readlines()
    data = json.loads(lines[4].strip())

schemas = data.get("components", {}).get("schemas", {})
with open("schemas_summary.txt", "w", encoding="utf-8") as f:
    for name, schema in schemas.items():
        f.write(f"Schema: {name}\n")
        properties = schema.get("properties", {})
        for prop_name, prop_details in properties.items():
            f.write(f"  - {prop_name}: {prop_details.get('type', 'any')} (ref: {prop_details.get('$ref', '')})\n")
        f.write("\n")
