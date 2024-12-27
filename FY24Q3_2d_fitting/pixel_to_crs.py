import pandas as pd
import numpy as np
from pyproj import CRS, Transformer
import argparse

# Function to load the world file and extract transformation parameters
def load_worldfile(worldfile_path):
    """Load world file and extract transformation parameters.

    Args:
        worldfile_path (str): Path to the world file.

    Returns:
        tuple: Parameters (a, b, c, d, e, f) extracted from the world file.
    """
    with open(worldfile_path, 'r') as file:
        lines = file.readlines()

    # Extract coefficients from the world file
    a = float(lines[0].strip())  # Pixel size in the X direction
    d = float(lines[1].strip())  # Rotation term (usually 0)
    b = float(lines[2].strip())  # Rotation term (usually 0)
    e = float(lines[3].strip())  # Pixel size in the Y direction (negative for top-down)
    c = float(lines[4].strip())  # X coordinate of the upper left corner of the image
    f = float(lines[5].strip())  # Y coordinate of the upper left corner of the image

    return a, b, c, d, e, f

# Function to transform pixel coordinates to CRS coordinates
def pixel_to_crs(a, b, c, d, e, f, x_pixel, y_pixel):
    """Convert pixel coordinates to CRS coordinates.

    Args:
        a, b, c, d, e, f (float): World file parameters.
        x_pixel (float): X coordinate in pixel space.
        y_pixel (float): Y coordinate in pixel space.

    Returns:
        tuple: CRS coordinates (x_crs, y_crs).
    """
    x_crs = a * x_pixel + b * y_pixel + c
    y_crs = d * x_pixel + e * y_pixel + f
    return x_crs, y_crs

# Function to transform CRS coordinates to pixel coordinates
def crs_to_pixel(a, b, c, d, e, f, x_crs, y_crs):
    """Convert CRS coordinates to pixel coordinates.

    Args:
        a, b, c, d, e, f (float): World file parameters.
        x_crs (float): X coordinate in CRS.
        y_crs (float): Y coordinate in CRS.

    Returns:
        tuple: Pixel coordinates (x_pixel, y_pixel).
    """
    det = a * e - b * d
    if det == 0:
        raise ValueError("Invalid world file parameters: determinant is zero.")

    x_pixel = (e * (x_crs - c) - b * (y_crs - f)) / det
    y_pixel = (-d * (x_crs - c) + a * (y_crs - f)) / det
    return x_pixel, y_pixel

# Main function to handle argument parsing and coordinate transformation
def main():
    """Main function to parse arguments and perform coordinate transformation."""
    # Set up argument parser
    parser = argparse.ArgumentParser(
        description="Transform coordinates between pixel and CRS systems using a world file."
    )
    parser.add_argument("csv", help="Path to the input CSV file.")
    parser.add_argument("worldfile", help="Path to the world file.")
    parser.add_argument(
        "mode", 
        choices=["pixel_to_crs", "crs_to_pixel"], 
        default="pixel_to_crs", 
        help="Mode of transformation (default: pixel_to_crs)."
    )

    args = parser.parse_args()

    # Load CSV and world file
    keypoints = pd.read_csv(args.csv)
    a, b, c, d, e, f = load_worldfile(args.worldfile)

    if args.mode == "pixel_to_crs":
        # Ensure CSV has the necessary columns
        if not {'x_pixel', 'y_pixel'}.issubset(keypoints.columns):
            raise ValueError("CSV file must contain 'x_pixel' and 'y_pixel' columns.")

        # Transform pixel coordinates to CRS coordinates
        crs_coords = keypoints.apply(
            lambda row: pixel_to_crs(a, b, c, d, e, f, row['x_pixel'], row['y_pixel']), axis=1
        )

        # Split tuples into separate columns
        keypoints[['x_crs', 'y_crs']] = pd.DataFrame(crs_coords.tolist(), index=keypoints.index)

    elif args.mode == "crs_to_pixel":
        # Ensure CSV has the necessary columns
        if not {'x_crs', 'y_crs'}.issubset(keypoints.columns):
            raise ValueError("CSV file must contain 'x_crs' and 'y_crs' columns.")

        # Transform CRS coordinates to pixel coordinates
        pixel_coords = keypoints.apply(
            lambda row: crs_to_pixel(a, b, c, d, e, f, row['x_crs'], row['y_crs']), axis=1
        )

        # Split tuples into separate columns
        keypoints[['x_pixel', 'y_pixel']] = pd.DataFrame(pixel_coords.tolist(), index=keypoints.index)

    # Overwrite the input CSV
    keypoints.to_csv(args.csv, index=False)
    print(f"Updated keypoints saved to {args.csv}")

if __name__ == "__main__":
    main()
