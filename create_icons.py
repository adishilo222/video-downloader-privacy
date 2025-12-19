#!/usr/bin/env python3
"""
Script to create icon files for the Chrome extension.
Creates a simple video downloader icon with a play button design.
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os
    
    def create_icon(size, filename):
        # Create a new image with a blue background (Chrome blue)
        img = Image.new('RGB', (size, size), color='#4285f4')
        draw = ImageDraw.Draw(img)
        
        # Draw a white circle for the play button background
        margin = max(size // 10, 2)
        circle_margin = margin * 2
        draw.ellipse(
            [circle_margin, circle_margin, size - circle_margin, size - circle_margin],
            fill='#ffffff',
            outline='#e0e0e0',
            width=max(1, size // 64)
        )
        
        # Draw a blue play button triangle
        play_size = size // 3
        center_x, center_y = size // 2, size // 2
        
        # Calculate triangle points (play button)
        triangle_offset = play_size // 6  # Slight offset to center visually
        triangle_points = [
            (center_x - play_size // 2 + triangle_offset, center_y - play_size // 2),
            (center_x - play_size // 2 + triangle_offset, center_y + play_size // 2),
            (center_x + play_size // 2 + triangle_offset, center_y),
        ]
        draw.polygon(triangle_points, fill='#4285f4')
        
        # Save the image
        img.save(filename, 'PNG', optimize=True)
        print(f"✓ Created {filename} ({size}x{size})")
    
    # Create icons directory if it doesn't exist
    icons_dir = 'icons'
    os.makedirs(icons_dir, exist_ok=True)
    
    # Create icons in different sizes
    print("Creating extension icons...")
    create_icon(16, os.path.join(icons_dir, 'icon16.png'))
    create_icon(48, os.path.join(icons_dir, 'icon48.png'))
    create_icon(128, os.path.join(icons_dir, 'icon128.png'))
    
    print("\n✅ All icons created successfully!")
    print(f"Icons saved in: {os.path.abspath(icons_dir)}/")
    
except ImportError:
    print("❌ Pillow (PIL) is required to create icons.")
    print("\nInstalling Pillow...")
    import subprocess
    import sys
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "--quiet"])
        print("✓ Pillow installed. Running script again...")
        # Re-run the script
        exec(open(__file__).read())
    except Exception as e:
        print(f"❌ Failed to install Pillow: {e}")
        print("\nPlease install Pillow manually:")
        print("  pip install Pillow")
        print("\nOr use one of these alternatives:")
        print("  1. Create icons manually using any image editor")
        print("  2. Use online icon generators")
        print("  3. Download free icons from Flaticon or Icons8")
except Exception as e:
    print(f"❌ Error creating icons: {e}")
    import traceback
    traceback.print_exc()
