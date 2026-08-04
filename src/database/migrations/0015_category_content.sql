-- Categories already existed (seeded in 0008) with no description/icon —
-- both columns were declared in the table from the start but left NULL.
-- `icon` stores a lucide-react icon component name (frontend maps the
-- string to the actual component); no new column needed.
UPDATE categories SET icon = 'Hammer', description = 'Custom furniture, framing, doors, and general woodwork for homes and offices.' WHERE slug = 'carpentry';
UPDATE categories SET icon = 'Zap', description = 'Wiring, rewiring, fault-finding, and installation of lights, sockets, and appliances.' WHERE slug = 'electrical';
UPDATE categories SET icon = 'Wrench', description = 'Pipe repairs, leak fixes, fittings, and installation of taps, sinks, and toilets.' WHERE slug = 'plumbing';
UPDATE categories SET icon = 'Building2', description = 'Block laying, foundations, plastering, and general concrete and brickwork.' WHERE slug = 'masonry';
UPDATE categories SET icon = 'Flame', description = 'Metal fabrication, gate and window welding, and structural repairs.' WHERE slug = 'welding';
UPDATE categories SET icon = 'Paintbrush', description = 'Interior and exterior painting, wall prep, and decorative finishes.' WHERE slug = 'painting';
UPDATE categories SET icon = 'Layers', description = 'Ceiling and wall plastering, POP designs, and smooth-finish work.' WHERE slug = 'pop-plastering';
UPDATE categories SET icon = 'Grid3x3', description = 'Floor and wall tiling for kitchens, bathrooms, and outdoor spaces.' WHERE slug = 'tiling';
UPDATE categories SET icon = 'Car', description = 'Vehicle diagnostics, servicing, and repairs for cars and light trucks.' WHERE slug = 'mechanics';
UPDATE categories SET icon = 'Sofa', description = 'Space planning, furnishing, and finishing touches for homes and offices.' WHERE slug = 'interior-decoration';
UPDATE categories SET icon = 'Shirt', description = 'Custom clothing, alterations, and made-to-measure tailoring.' WHERE slug = 'fashion-tailoring';
UPDATE categories SET icon = 'Armchair', description = 'Custom-built furniture, cabinetry, and woodwork to order.' WHERE slug = 'furniture-making';
UPDATE categories SET icon = 'Code2', description = 'Websites, web apps, and e-commerce builds — from landing pages to full platforms.' WHERE slug = 'web-development';
UPDATE categories SET icon = 'Palette', description = 'Logos, branding, print, and digital design work.' WHERE slug = 'graphic-design';
UPDATE categories SET icon = 'Megaphone', description = 'Social media management, ads, SEO, and content strategy.' WHERE slug = 'digital-marketing';
UPDATE categories SET icon = 'PenTool', description = 'Copywriting, editing, proofreading, and content creation.' WHERE slug = 'writing-editing';
UPDATE categories SET icon = 'Video', description = 'Video editing, motion graphics, and animation for ads, social, and events.' WHERE slug = 'video-animation';
UPDATE categories SET icon = 'Headset', description = 'Admin support, scheduling, data entry, and remote business assistance.' WHERE slug = 'virtual-assistant';
UPDATE categories SET icon = 'Bot', description = 'AI integrations, workflow automation, and custom tooling for businesses.' WHERE slug = 'ai-automation';
