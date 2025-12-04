import requests
import json

BASE_URL = "http://localhost:8080"

def test_projects_flow():
    print("Testing Projects API Flow...")

    # 1. Create a Project
    print("\n1. Creating a Project...")
    project_data = {
        "name": "Test Project",
        "description": "A test project for verification",
        "context": "Fashion context"
    }
    response = requests.post(f"{BASE_URL}/projects/", json=project_data)
    if response.status_code != 200:
        print(f"Failed to create project: {response.text}")
        return
    
    project = response.json()
    print(f"Project created: {project['id']} - {project['name']}")
    project_id = project['id']

    # 2. List Projects
    print("\n2. Listing Projects...")
    response = requests.get(f"{BASE_URL}/projects/")
    if response.status_code != 200:
        print(f"Failed to list projects: {response.text}")
        return
    
    projects = response.json()
    print(f"Found {len(projects)} projects")
    found = False
    for p in projects:
        if p['id'] == project_id:
            found = True
            break
    
    if found:
        print("Created project found in list.")
    else:
        print("Created project NOT found in list.")

    # 3. Get Project Details (should be empty assets initially)
    print("\n3. Getting Project Details...")
    response = requests.get(f"{BASE_URL}/projects/{project_id}")
    if response.status_code != 200:
        print(f"Failed to get project details: {response.text}")
        return
    
    project_details = response.json()
    assets = project_details.get('assets', [])
    print(f"Project assets count: {len(assets)}")
    
    if assets:
        asset_id = assets[0]['id']
        print(f"Deleting asset {asset_id}...")
        response = requests.delete(f"{BASE_URL}/assets/{asset_id}")
        if response.status_code == 200:
            print("Asset deleted successfully.")
        else:
            print(f"Failed to delete asset: {response.text}")

    # 4. Delete Project
    print("\n4. Deleting Project...")
    response = requests.delete(f"{BASE_URL}/projects/{project_id}")
    if response.status_code != 200:
        print(f"Failed to delete project: {response.text}")
        return
    
    print("Project deleted successfully.")

    # 5. Verify Deletion
    print("\n5. Verifying Deletion...")
    response = requests.get(f"{BASE_URL}/projects/{project_id}")
    if response.status_code == 404:
        print("Project correctly not found (404).")
    else:
        print(f"Project still exists or error: {response.status_code}")

    print("\nVerification Complete.")

if __name__ == "__main__":
    try:
        test_projects_flow()
    except Exception as e:
        print(f"Test failed with exception: {e}")
