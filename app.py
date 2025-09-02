"""THE MAIN BACKEND API FOR THE ATTENTION DETECTOR"""
from flask import Flask, render_template, jsonify, request
import time
import threading
from flask import send_from_directory
app = Flask(__name__, static_folder='static')

@app.route('/static/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('static/js', filename, mimetype='application/javascript')

@app.route('/static/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('static/css', filename, mimetype='text/css')




# Global state variables
global_state = {
    "is_tracking": False,
    "elapsed_time": "00:00:00",
    "attentiveness": 0,
    "current_status": "Not Tracking",
    "attentive_time": "00:00:00",
    "distracted_time": "00:00:00",
    "focus_cycles": 0
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/start_tracking', methods=['POST'])
def start_tracking():
    global global_state
    global_state = {
        "is_tracking": True,
        "elapsed_time": "00:00:00",
        "attentiveness": 0,
        "current_status": "Attentive",
        "attentive_time": "00:00:00",
        "distracted_time": "00:00:00",
        "focus_cycles": 0
    }
    return jsonify({"status": "started"})

@app.route('/stop_tracking', methods=['POST'])
def stop_tracking():
    global global_state
    global_state["is_tracking"] = False
    return jsonify({"status": "stopped"})

@app.route('/sync_stats', methods=['POST'])
def sync_stats():
    global global_state
    data = request.json
    global_state.update(data)
    return jsonify({"status": "synced"})

@app.route('/get_stats')
def get_stats():
    # This endpoint is still needed for the initial load and to retrieve state
    # if the page is refreshed.
    return jsonify(global_state)

if __name__ == "__main__":
    # Start the Flask app
    app.run(debug=True, threaded=True, use_reloader=False)