import json

# Load the API keys from the JSON file
def load_api_keys():
    with open('api_keys.json', 'r') as file:
        keys = json.load(file)
    return keys['api_keys']