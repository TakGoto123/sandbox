import matplotlib.pyplot as plt
import numpy as np

def plot_adjustments(reference_points, reference_segments, target_points, target_points_on_segments, dx_dy_theta_scale_labels):
    """
    Plot reference points, reference segments, target points, target points on segments, and adjusted points for multiple scenarios.

    Args:
        reference_points (dict): Reference points with their positions.
        reference_segments (list): Reference segments as tuples of start and end points.
        target_points (dict): Original target points with their positions.
        target_points_on_segments (list): List of target points corresponding to segments.
        dx_dy_theta_scale_labels (list): List of dictionaries containing dx, dy, theta, scale, labels, and colors.
    """
    plt.figure(figsize=(12, 8))

    # Plot reference points
    for key, pos in reference_points.items():
        plt.scatter(pos[0], pos[1], color='red', marker='o', label='Reference Points' if key == list(reference_points.keys())[0] else "")
        plt.text(pos[0] + 0.1, pos[1], key, color='red', fontsize=5)

    # Plot reference segments
    for start, end in reference_segments:
        plt.plot([start[0], end[0]], [start[1], end[1]], color='red', linestyle='-', label='Reference Segments' if start is reference_segments[0][0] else "")

    # Apply transformations and plot adjusted points for each scenario
    for scenario in dx_dy_theta_scale_labels:
        dx = scenario['dx']
        dy = scenario['dy']
        theta = scenario['theta']
        scale = scenario['scale']
        label = scenario['label']
        color = scenario['color']

        # Compute rotation matrix
        rotation_matrix = np.array([
            [np.cos(theta), -np.sin(theta)],
            [np.sin(theta), np.cos(theta)]
        ])

        # Transform target points
        adjusted_points = {
            key: (scale * (np.array(pos) @ rotation_matrix.T) + np.array([dx, dy]))
            for key, pos in target_points.items()
        }

        # Transform target points on segments
        adjusted_points_on_segments = [
            [scale * (np.array(pos) @ rotation_matrix.T) + np.array([dx, dy]) for pos in segment]
            for segment in target_points_on_segments
        ]

        for key, pos in adjusted_points.items():
            plt.scatter(pos[0], pos[1], color=color, marker='o', label=f'{label} Adjusted Points' if key == list(adjusted_points.keys())[0] else "", alpha=0.7)
            plt.text(pos[0] + 0.1, pos[1], key, fontsize=5)

        for i, segment_points in enumerate(adjusted_points_on_segments):
            for j, pos in enumerate(segment_points):
                plt.scatter(pos[0], pos[1], color=color, marker='d', label=f'{label} Adjusted Points on Segments' if i == 0 and j == 0 else "", alpha=0.7)
                plt.text(pos[0] + 0.1, pos[1], f"S{i+1}_P{j+1}", fontsize=5)

    plt.title("Adjusted Points Across Scenarios", fontsize=16)
    plt.xlabel("X Coordinate", fontsize=14)
    plt.ylabel("Y Coordinate", fontsize=14)
    plt.gca().set_aspect('equal', adjustable='box')  # Ensure equal scaling
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.show()

# Example usage
if __name__ == "__main__":
    reference_points_example = {
        "A": [1.0, 2.0],
        "B": [3.0, 4.0]
    }

    reference_segments_example = [
        ([1.0, 2.0], [3.0, 4.0]),
        ([3.0, 4.0], [5.0, 6.0])
    ]

    target_points_example = {
        "A": [0.5, 2.5],
        "B": [3.5, 3.5]
    }

    target_points_on_segments_example = [
        [[2.0, 3.0], [2.5, 3.5]],
        [[3.5, 4.5], [4.0, 5.0]]
    ]

    dx_dy_theta_scale_labels_example = [
        {"dx": 0.1, "dy": 0.2, "theta": np.radians(10), "scale": 1.1, "label": "Scenario 1", "color": "blue"},
        {"dx": -0.2, "dy": 0.3, "theta": np.radians(-5), "scale": 0.9, "label": "Scenario 2", "color": "green"}
    ]

    plot_adjustments(
        reference_points_example,
        reference_segments_example,
        target_points_example,
        target_points_on_segments_example,
        dx_dy_theta_scale_labels_example
    )
