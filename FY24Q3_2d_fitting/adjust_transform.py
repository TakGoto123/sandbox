from bundle_adjustment_2d import optimize_transformation, point_to_segment_distance
from plot_results import plot_adjustments
import numpy as np
import pandas as pd
import argparse
import yaml

def str_to_bool(value):
    """
    Convert a string to a boolean value.

    Args:
        value (str): Input string (e.g., "true", "false", "t", "f").

    Returns:
        bool: Converted boolean value.

    Raises:
        argparse.ArgumentTypeError: If the value cannot be converted to boolean.
    """
    if isinstance(value, bool):
        return value
    if value.lower() in ('yes', 'true', 't', 'y', '1'):
        return True
    elif value.lower() in ('no', 'false', 'f', 'n', '0'):
        return False
    else:
        raise argparse.ArgumentTypeError(f"Boolean value expected, got {value}.")

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

def calculate_residuals(points, segments, translation, theta, scale):
    """
    Calculate residuals for points and segments.

    Args:
        points (dict): Filtered points data.
        segments (dict): Filtered segments data.
        translation (np.ndarray): Translation vector.
        theta (float): Rotation angle in radians.
        scale (float): Scaling factor.

    Returns:
        dict: Residuals for points and segments.
    """
    residual_dict = {}

    # Rotation matrix for transformation
    rotation_matrix = np.array([
        [np.cos(theta), -np.sin(theta)],
        [np.sin(theta), np.cos(theta)]
    ])

    for key, value in points.items():
        transformed_target = (
            (np.array(value['target_position']) @ rotation_matrix.T) * scale + translation
        )
        residual = np.linalg.norm(transformed_target - np.array(value['reference_position']))
        residual_dict[key] = round(residual, 4)

    for key, value in segments.items():
        segment = (
            np.array(value['reference_segment']['start']),
            np.array(value['reference_segment']['end'])
        )
        for i, target_point in enumerate(value['target_points']):
            transformed_target_point = (
                (np.array(target_point) @ rotation_matrix.T) * scale + translation
            )
            residual = point_to_segment_distance(transformed_target_point, segment)
            residual_dict[f"{key}_Point{i+1}"] = round(residual, 4)

    return residual_dict

def display_results(translation, theta, scale, residual_dict, label="Results"):
    """
    Display optimization results and residuals.

    Args:
        translation (np.ndarray): Translation vector.
        theta (float): Rotation angle in radians.
        scale (float): Scaling factor.
        residual_dict (dict): Residuals for points and segments.
        label (str): Label for the parameter set (e.g., "Results").
    """
    theta_degrees = np.degrees(theta)
    print(f"{label} Translation (dx, dy):", translation)
    print(f"{label} Rotation (theta in degrees):", theta_degrees)
    print(f"{label} Scale:", scale)

    residuals_df = pd.DataFrame(list(residual_dict.items()), columns=["Point/Segment", "Residual"])
    residuals_df.loc["Mean"] = ["Mean", round(residuals_df["Residual"].mean(), 4)]

    print(f"{label} Residuals:")
    print(residuals_df)

def main():
    """
    Main entry point for running the script.
    """
    parser = argparse.ArgumentParser(description="Run bundle adjustment with residual calculation.")
    parser.add_argument("yaml_file", type=str, help="Path to the YAML file containing input data.")
    parser.add_argument("--plot_result", action="store_true", help="Generate and display plots for the results.")
    args = parser.parse_args()

    # Load data from YAML
    data = load_data_from_yaml(args.yaml_file)

    # Extract optimization data
    filtered_points, filtered_segments = extract_data_by_mode(data, modes=["optimize"])

    # Convert data for optimization
    optimize_reference_points, optimize_target_points, optimize_segments, optimize_target_points_on_segments = convert_data_for_optimization(
        filtered_points, filtered_segments
    )

    # Optimization scenarios
    scenarios = []

    colors = ["blue", "green", "purple", "orange"]  # Colors for each scenario excluding red

    for label, color, optimize_translation, optimize_rotation, optimize_scale in zip(
        ["Initial", "Translation Only", "Translation + Rotation", "Translation + Rotation + Scale"],
        colors,
        [False, True, True, True],
        [False, False, True, True],
        [False, False, False, True]
    ):
        if label == "Initial":
            # Use default parameters for "Initial"
            translation = np.array([0.0, 0.0])
            theta = 0.0
            scale = 1.0
            residuals = calculate_residuals(
                filtered_points, filtered_segments, translation, theta, scale
            )
        else:
            # Optimize for the given scenario
            translation, theta, scale = optimize_transformation(
                optimize_reference_points,
                optimize_target_points,
                optimize_segments,
                optimize_target_points_on_segments,
                optimize_translation=optimize_translation,
                optimize_rotation=optimize_rotation,
                optimize_scale=optimize_scale
            )
            residuals = calculate_residuals(
                filtered_points, filtered_segments, translation, theta, scale
            )

        scenarios.append({
            "label": label,
            "reference_points": {key: value['reference_position'] for key, value in filtered_points.items()},
            "reference_segments": [
                (value['reference_segment']['start'], value['reference_segment']['end'])
                for value in filtered_segments.values()
            ],
            "target_points": {key: value['target_position'] for key, value in filtered_points.items()},
            "target_points_on_segments": [
                [np.array(point) for point in value['target_points']]
                for value in filtered_segments.values()
            ],
            "dx": translation[0],
            "dy": translation[1],
            "theta": theta,
            "scale": scale,
            "color": color
        })

    if args.plot_result:
        plot_adjustments(
            {key: value['reference_position'] for key, value in filtered_points.items()},
            [
                (value['reference_segment']['start'], value['reference_segment']['end'])
                for value in filtered_segments.values()
            ],
            {key: value['target_position'] for key, value in filtered_points.items()},
            [
                [np.array(point) for point in value['target_points']]
                for value in filtered_segments.values()
            ],
            [{
                "dx": scenario['dx'],
                "dy": scenario['dy'],
                "theta": scenario['theta'],
                "scale": scenario['scale'],
                "label": scenario['label'],
                "color": scenario['color']
            } for scenario in scenarios]
        )

if __name__ == "__main__":
    main()
