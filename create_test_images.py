from PIL import Image

def create_solid_color_image(filename, color):
    img = Image.new('RGB', (100, 100), color=color)
    img.save(filename)

create_solid_color_image('style.png', 'red')
create_solid_color_image('product.png', 'blue')
create_solid_color_image('scene.png', 'green')
print("Test images created.")
