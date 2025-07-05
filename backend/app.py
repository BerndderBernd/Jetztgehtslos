import os
import io
import base64
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from PIL import Image, ImageFilter, ImageOps

app = Flask(__name__)
CORS(app)

# Ordner für hochgeladene und verarbeitete Bilder
UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
PROJECTS_FOLDER = 'projects'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(PROJECTS_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return "Bilderbuch-Generator Backend Läuft!"

@app.route('/process-image', methods=['POST'])
def process_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file found'}), 400

    file = request.files['image']
    style = request.form.get('style', 'picture-book') # Standard: 'picture-book'

    if file.filename == '':
        return jsonify({'error': 'No selected image'}), 400

    if file:
        image_stream = io.BytesIO(file.read())
        original_image = Image.open(image_stream).convert("RGB")

        processed_image = original_image
        base_filename, file_extension = os.path.splitext(file.filename)
        output_extension = ".png"
        
        if style == 'cartoon':
            print(f"Verarbeite Bild als Cartoon: {base_filename}")
            processed_image = original_image.quantize(colors=8).convert("RGB")
            processed_image = processed_image.filter(ImageFilter.CONTOUR)
            processed_image = processed_image.filter(ImageFilter.SMOOTH_MORE)
            filename_prefix = "cartoon_"

        elif style == 'coloring-book':
            print(f"Verarbeite Bild als Ausmalbild: {base_filename}")
            processed_image = original_image.convert("L")
            processed_image = processed_image.filter(ImageFilter.FIND_EDGES)
            processed_image = ImageOps.invert(processed_image)
            processed_image = processed_image.point(lambda p: p > 128 and 255)
            processed_image = processed_image.convert("1")

            filename_prefix = "coloring_"

        else: # 'picture-book' oder unbekannt
            print(f"Verarbeite Bild als normales Bilderbuch: {base_filename}")
            filename_prefix = "original_"
        
        filename_to_save = f"{filename_prefix}{base_filename}{output_extension}"
        processed_filepath = os.path.join(PROCESSED_FOLDER, filename_to_save)
        
        counter = 1
        original_name_part = f"{filename_prefix}{base_filename}"
        while os.path.exists(processed_filepath):
            file_path_check = os.path.join(PROCESSED_FOLDER, f"{original_name_part}_{counter}{output_extension}")
            if not os.path.exists(file_path_check):
                processed_filepath = file_path_check
                break
            counter += 1
        
        if os.path.exists(processed_filepath) and counter > 1:
             processed_filepath = os.path.join(PROCESSED_FOLDER, f"{original_name_part}_{os.urandom(4).hex()}{output_extension}")


        processed_image.save(processed_filepath)
        image_url = f"http://127.0.0.1:5000/processed/{os.path.basename(processed_filepath)}"
        return jsonify({'message': 'Image successfully processed', 'imageUrl': image_url})

    return jsonify({'error': 'Failed to upload image'}), 500

# Route, um verarbeitete Bilder auszuliefern
@app.route('/processed/<filename>')
def serve_processed_image(filename):
    return send_from_directory(PROCESSED_FOLDER, filename)

# Route zum Speichern eines Projekts
@app.route('/save-project', methods=['POST'])
def save_project():
    data = request.json
    if not data:
        return jsonify({'error': 'No project data provided'}), 400

    project_name = data.get('projectName', 'default_project')
    project_data = data.get('projectData')

    if not project_data:
        return jsonify({'error': 'No project data content'}), 400

    safe_project_name = "".join([c for c in project_name if c.isalnum() or c in (' ', '.', '_')]).rstrip()
    if not safe_project_name:
        safe_project_name = "unnamed_project"

    file_path = os.path.join(PROJECTS_FOLDER, f"{safe_project_name}.json")

    counter = 1
    original_base_name = safe_project_name
    while os.path.exists(file_path):
        file_path = os.path.join(PROJECTS_FOLDER, f"{original_base_name}_{counter}.json")
        counter += 1
    
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(project_data, f, indent=4)
        print(f"Projekt '{safe_project_name}' erfolgreich gespeichert unter: {file_path}")
        return jsonify({'message': 'Project saved successfully', 'filePath': os.path.basename(file_path)}), 200
    except Exception as e:
        print(f"Fehler beim Speichern des Projekts: {e}")
        return jsonify({'error': f'Failed to save project: {str(e)}'}), 500

# Route zum Laden eines Projekts
@app.route('/load-project/<project_name>', methods=['GET'])
def load_project(project_name):
    safe_project_name = "".join([c for c in project_name if c.isalnum() or c in (' ', '.', '_')]).rstrip()
    file_path = os.path.join(PROJECTS_FOLDER, f"{safe_project_name}.json")

    if not os.path.exists(file_path):
        projects_in_folder = [f.split('.json')[0] for f in os.listdir(PROJECTS_FOLDER) if f.endswith('.json')]
        matching_projects = [p for p in projects_in_folder if p.startswith(safe_project_name) and (p == safe_project_name or p.replace(safe_project_name, '').startswith('_'))]
        
        if matching_projects:
            found_project_name = sorted(matching_projects)[0]
            file_path = os.path.join(PROJECTS_FOLDER, f"{found_project_name}.json")
        else:
            return jsonify({'error': 'Project not found'}), 404

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            project_data = json.load(f)
        print(f"Projekt '{os.path.basename(file_path).replace('.json', '')}' erfolgreich geladen von: {file_path}")
        return jsonify({'projectData': project_data}), 200
    except Exception as e:
        print(f"Fehler beim Laden des Projekts: {e}")
        return jsonify({'error': f'Failed to load project: {str(e)}'}), 500

# Route, um eine Liste aller gespeicherten Projekte zu bekommen
@app.route('/list-projects', methods=['GET'])
def list_projects():
    try:
        projects = []
        for f in os.listdir(PROJECTS_FOLDER):
            if f.endswith('.json'):
                projects.append(f.replace('.json', ''))
        return jsonify({'projects': sorted(projects)}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to list projects: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True)