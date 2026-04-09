# ML Data Directory
# ===================
# This directory stores raw and processed training data.
#
# Expected files:
#   - raw_traffic_data.csv        — Raw traffic observations (edge traversals)
#   - processed_features.csv      — Output of preprocess.py (training-ready)
#   - feature_metadata.json       — Feature column definitions and encoding maps
#
# Data sources:
#   - OSM road network exports (via OSMnx)
#   - Traffic API historical data (Google, HERE, TomTom)
#   - Simulated traffic data (for hackathon demos)
#
# NOTE: Data files (.csv, .parquet) are in .gitignore
