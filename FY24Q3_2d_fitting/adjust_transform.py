from bundle_adjustment_2d import optimize_transformation, point_to_segment_distance
import numpy as np
import pandas as pd
import argparse
import yaml

def load_data_from_yaml(file_path):
    """
    Load input data from a YAML file.

    Args:
        file_path (str): Path to the YAML file.

    Returns:
        dict: Parsed YAML data.
    """
    with open(file_path, 'r') as f:
        return yaml.safe_load(f)

def extract_data_by_mode(data, modes):
    """
    Extract points and segments based on specified modes.

    Args:
        data (dict): Input data containing points and segments.
        modes (list): List of modes to filter by.

    Returns:
        tuple: Filtered points and segments.
    """
    filtered_points = {
        key: value for key, value in data.items()
        if value['type'] == 'point' and value['mode'] in modes
    }
    filtered_segments = {
        key: value for key, value in data.items()
        if value['type'] == 'segment' and value['mode'] in modes
    }
    return filtered_points, filtered_segments

def convert_data_for_optimization(points, segments):
    """
    Convert extracted data into a format suitable for optimization.

    Args:
        points (dict): Filtered points data.
        segments (dict): Filtered segments data.

    Returns:
        tuple: Arrays for reference points, target points, segments, and target points on segments.
    """
    optimize_reference_points = [np.array(value['reference_position']) for value in points.values()]
    optimize_target_points = [np.array(value['target_position']) for value in points.values()]

    optimize_segments = [
        (
            np.array(value['reference_segment']['start']),
            np.array(value['reference_segment']['end'])
        )
        for value in segments.values()
    ]
    optimize_target_points_on_segments = [
        [np.array(point) for point in value['target_points']]
        for value in segments.values()
    ]

    return (
        np.array(optimize_reference_points),
        np.array(optimize_target_points),
        optimize_segments,
        optimize_target_points_on_segments
    )

def calculate_residuals(points, segments, optimal_translation, optimal_theta, optimal_scale):
    """
    Calculate residuals for points and segments.

    Args:
        points (dict): Filtered points data.
        segments (dict): Filtered segments data.
        optimal_translation (np.ndarray): Optimal translation vector.
        optimal_theta (float): Optimal rotation angle in radians.
        optimal_scale (float): Optimal scaling factor.

    Returns:
        dict: Residuals for points and segments.
    """
    residual_dict = {}

    for key, value in points.items():
        transformed_reference = (
            np.array(value['reference_position']) * optimal_scale + optimal_translation
        )
        residual = np.linalg.norm(transformed_reference - np.array(value['target_position']))
        residual_dict[key] = round(residual, 4)

    for key, value in segments.items():
        segment = (
            np.array(value['reference_segment']['start']),
            np.array(value['reference_segment']['end'])
        )
        for i, target_point in enumerate(value['target_points']):
            residual = point_to_segment_distance(np.array(target_point), segment)
            residual_dict[f"{key}_Point{i+1}"] = round(residual, 4)

    return residual_dict

def display_results(optimal_translation, optimal_theta, optimal_scale, residual_dict):
    """
    Display optimization results and residuals.

    Args:
        optimal_translation (np.ndarray): Optimal translation vector.
        optimal_theta (float): Optimal rotation angle in radians.
        optimal_scale (float): Optimal scaling factor.
        residual_dict (dict): Residuals for points and segments.
    """
    print("Optimal Results:")
    print("Optimal Translation (dx, dy):", optimal_translation)
    print("Optimal Rotation (theta in radians):", optimal_theta)
    print("Optimal Scale:", optimal_scale)

    residuals_df = pd.DataFrame(list(residual_dict.items()), columns=["Point/Segment", "Residual"])
    residuals_df.loc["Mean"] = ["Mean", round(residuals_df["Residual"].mean(), 4)]

    print("Residuals:")
    print(residuals_df)

def main():
    """
    Main entry point for running the script.
    """
    parser = argparse.ArgumentParser(description="Run bundle adjustment with residual calculation.")
    parser.add_argument("yaml_file", type=str, help="Path to the YAML file containing input data.")
    parser.add_argument("--optimize_translation", type=bool, default=True, help="Enable or disable translation optimization (default: True).")
    parser.add_argument("--optimize_rotation", type=bool, default=True, help="Enable or disable rotation optimization (default: True).")
    parser.add_argument("--optimize_scale", type=bool, default=True, help="Enable or disable scale optimization (default: True).")
    args = parser.parse_args()

    # Load data from YAML
    data = load_data_from_yaml(args.yaml_file)

    # Extract optimization data
    filtered_points, filtered_segments = extract_data_by_mode(data, modes=["optimize"])

    # Convert data for optimization
    optimize_reference_points, optimize_target_points, optimize_segments, optimize_target_points_on_segments = convert_data_for_optimization(
        filtered_points, filtered_segments
    )

    # Run optimization
    optimal_translation, optimal_theta, optimal_scale = optimize_transformation(
        optimize_reference_points,
        optimize_target_points,
        optimize_segments,
        optimize_target_points_on_segments,
        optimize_translation=args.optimize_translation,
        optimize_rotation=args.optimize_rotation,
        optimize_scale=args.optimize_scale
    )

    # Extract residual data
    filtered_points, filtered_segments = extract_data_by_mode(data, modes=["residual", "optimize"])

    # Calculate residuals
    residual_dict = calculate_residuals(
        filtered_points, filtered_segments, optimal_translation, optimal_theta, optimal_scale
    )

    # Display results
    display_results(optimal_translation, optimal_theta, optimal_scale, residual_dict)

if __name__ == "__main__":
    main()
