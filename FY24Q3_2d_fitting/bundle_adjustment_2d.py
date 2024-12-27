import numpy as np
from scipy.optimize import minimize
import argparse

# Core functions

def point_to_segment_distance(point, segment):
    """
    Calculate the distance from a point to a segment.

    Args:
        point (np.ndarray): The point to measure distance from.
        segment (tuple): The segment defined by two endpoints.

    Returns:
        float: The shortest distance from the point to the segment.
    """
    p1, p2 = segment
    line_vec = p2 - p1
    point_vec = point - p1
    line_len = np.linalg.norm(line_vec)
    if line_len == 0:
        return np.linalg.norm(point - p1)
    line_unitvec = line_vec / line_len
    projection = np.dot(point_vec, line_unitvec)
    if projection < 0.0:
        closest_point = p1
    elif projection > line_len:
        closest_point = p2
    else:
        closest_point = p1 + projection * line_unitvec
    return np.linalg.norm(point - closest_point)

def calculate_transformation_matrix(theta, scale):
    """
    Precompute the transformation matrix for rotation and scaling.

    Args:
        theta (float): Rotation angle in radians.
        scale (float): Scaling factor.

    Returns:
        np.ndarray: Transformation matrix.
    """
    rotation_matrix = np.array([
        [np.cos(theta), -np.sin(theta)],
        [np.sin(theta), np.cos(theta)]
    ])
    return rotation_matrix * scale

def transform_points(points, dx, dy, transformation_matrix):
    """
    Transform points based on given translation and a precomputed transformation matrix.

    Args:
        points (np.ndarray): Points to transform.
        dx (float): Translation in x-direction.
        dy (float): Translation in y-direction.
        transformation_matrix (np.ndarray): Precomputed rotation and scaling matrix.

    Returns:
        np.ndarray: Transformed points.
    """
    return (points @ transformation_matrix.T) + np.array([dx, dy])

def error_function(params, reference_points, target_points, reference_segments, target_points_on_segments, optimize_translation, optimize_rotation, optimize_scale, residuals=None):
    """
    Calculate the total error between transformed target data and reference data.

    Args:
        params (np.ndarray): Transformation parameters (translation, rotation, scale).
        reference_points (np.ndarray): Reference points.
        target_points (np.ndarray): Target points.
        reference_segments (list): List of reference line segments.
        target_points_on_segments (list): List of target points on segments.
        optimize_translation (bool): Whether to optimize translation.
        optimize_rotation (bool): Whether to optimize rotation.
        optimize_scale (bool): Whether to optimize scaling.
        residuals (list, optional): List to append individual residuals to.

    Returns:
        float: Total error.
    """
    param_idx = 0
    dx, dy, theta, scale = 0.0, 0.0, 0.0, 1.0

    if optimize_translation:
        dx, dy = params[param_idx], params[param_idx + 1]
        param_idx += 2
    if optimize_rotation:
        theta = params[param_idx]
        param_idx += 1
    if optimize_scale:
        scale = params[param_idx]

    transformation_matrix = calculate_transformation_matrix(theta, scale)

    # Handle empty target points
    point_to_point_error = 0.0
    point_to_point_residuals = []
    if len(target_points) > 0:
        transformed_target = transform_points(target_points, dx, dy, transformation_matrix)
        point_to_point_residuals = np.linalg.norm(reference_points - transformed_target, axis=1)
        point_to_point_error = np.sum(point_to_point_residuals ** 2)

    # Handle empty target points on segments
    point_to_segment_residuals = []
    point_to_segment_error = 0.0
    if len(target_points_on_segments) > 0:
        for segment, targets in zip(reference_segments, target_points_on_segments):
            for target_point in targets:
                transformed_target_point = transform_points(np.array([target_point]), dx, dy, transformation_matrix)[0]
                dist = point_to_segment_distance(transformed_target_point, segment)
                point_to_segment_residuals.append(dist)
        point_to_segment_error = np.sum(np.array(point_to_segment_residuals) ** 2)

    if residuals is not None:
        residuals.extend(point_to_point_residuals)
        residuals.extend(point_to_segment_residuals)

    return point_to_point_error + point_to_segment_error

def create_initial_params(optimize_translation, optimize_rotation, optimize_scale):
    """
    Create the initial parameters for optimization.

    Args:
        optimize_translation (bool): Include translation in optimization.
        optimize_rotation (bool): Include rotation in optimization.
        optimize_scale (bool): Include scaling in optimization.

    Returns:
        list: Initial parameter values.
    """
    params = []
    if optimize_translation:
        params.extend([0.0, 0.0])
    if optimize_rotation:
        params.append(0.0)
    if optimize_scale:
        params.append(1.0)
    return params

def optimize_transformation(reference_points, target_points, reference_segments, target_points_on_segments, optimize_translation=True, optimize_rotation=True, optimize_scale=True):
    """
    Optimize transformation parameters to align target data with reference data.

    Args:
        reference_points (np.ndarray): Reference points.
        target_points (np.ndarray): Target points.
        reference_segments (list): List of reference line segments.
        target_points_on_segments (list): List of target points on segments.
        optimize_translation (bool): Optimize translation.
        optimize_rotation (bool): Optimize rotation.
        optimize_scale (bool): Optimize scaling.

    Returns:
        tuple: Optimal translation, rotation, and scaling values.
    """
    initial_params = create_initial_params(optimize_translation, optimize_rotation, optimize_scale)

    if len(initial_params) == 0:
        raise ValueError("No optimization parameters specified.")

    result = minimize(
        error_function,
        initial_params,
        args=(reference_points, target_points, reference_segments, target_points_on_segments, optimize_translation, optimize_rotation, optimize_scale),
        method='BFGS'
    )

    optimal_params = result.x
    params_index = 0
    dx, dy, theta, scale = 0.0, 0.0, 0.0, 1.0

    if optimize_translation:
        dx, dy = optimal_params[params_index], optimal_params[params_index + 1]
        params_index += 2
    if optimize_rotation:
        theta = optimal_params[params_index]
        params_index += 1
    if optimize_scale:
        scale = optimal_params[params_index]

    return [dx, dy], theta, scale

def main():
    """
    Main entry point for the program.
    """
    parser = argparse.ArgumentParser(description="Optimize 2D transformation parameters.")
    parser.add_argument("--optimize_translation", type=bool, default=True, help="Enable or disable translation optimization (default: True).")
    parser.add_argument("--optimize_rotation", type=bool, default=True, help="Enable or disable rotation optimization (default: True).")
    parser.add_argument("--optimize_scale", type=bool, default=True, help="Enable or disable scale optimization (default: True).")
    args = parser.parse_args()

    # Example input data
    reference = np.array([
        [1.0, 2.0],
        [2.0, 3.0],
        [3.0, 5.0]
    ])

    target = np.array([
        [4.0, 6.0],
        [5.0, 7.0],
        [6.0, 9.0]
    ])

    reference_segments = [
        (np.array([1.0, 2.0]), np.array([3.0, 5.0])),
        (np.array([2.0, 3.0]), np.array([4.0, 6.0]))
    ]

    target_points_on_segments = [
        [np.array([2.5, 3.5]), np.array([2.8, 3.7])],
        [np.array([3.0, 4.5]), np.array([3.2, 4.8])]
    ]

    # Run optimization
    optimal_translation, optimal_theta, optimal_scale = optimize_transformation(
        reference,
        target,
        reference_segments,
        target_points_on_segments,
        optimize_translation=args.optimize_translation,
        optimize_rotation=args.optimize_rotation,
        optimize_scale=args.optimize_scale
    )

    # Residual calculation
    residuals = []
    error_function(
        np.concatenate([optimal_translation, [optimal_theta, optimal_scale]]),
        reference,
        target,
        reference_segments,
        target_points_on_segments,
        args.optimize_translation,
        args.optimize_rotation,
        args.optimize_scale,
        residuals
    )

    # Output results
    print("Optimal Translation (dx, dy):", optimal_translation)
    print("Optimal Rotation (theta in radians):", optimal_theta)
    print("Optimal Scale:", optimal_scale)
    print("Residuals:")
    for i, residual in enumerate(residuals):
        print(f"Residual {i + 1}: {residual}")

if __name__ == "__main__":
    main()
