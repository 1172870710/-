extends TileMapLayer
class_name TownMap

# ============================================
# 占位小镇地图加载器
#
# 从 assets/maps/town.tmx 加载 Tiled 地图
# 地图加载完成后自动生成 NPC
# ============================================

@export var map_path: String = "res://assets/maps/town.tmx"
@export var tileset_path: String = "res://assets/maps/tileset_placeholder.png"
@export var npc_scene: PackedScene = preload("res://scenes/world/npc.tscn")

func _ready() -> void:
	_load_tmx()

func _load_tmx() -> void:
	# 1. 读取 .tmx 文件
	if not FileAccess.file_exists(map_path):
		printerr("TownMap: 找不到地图文件 ", map_path)
		return

	var file: FileAccess = FileAccess.open(map_path, FileAccess.READ)
	if not file:
		printerr("TownMap: 无法打开 ", map_path)
		return

	var xml_text: String = file.get_as_text()
	file.close()

	# 2. 解析 XML（简单解析，不做完整 XML Parser）
	var width: int = _parse_int(xml_text, 'width="')
	var height: int = _parse_int(xml_text, 'height="')
	var tile_w: int = _parse_int(xml_text, 'tilewidth="')
	var tile_h: int = _parse_int(xml_text, 'tileheight="')

	print("TownMap: %dx%d tiles, %dx%d px" % [width, height, tile_w, tile_h])

	# 3. 解析 CSV 数据
	var data_start: int = xml_text.find("<data encoding=\"csv\">")
	var data_end: int = xml_text.find("</data>", data_start)
	var csv: String = xml_text.substr(data_start, data_end - data_start)
	csv = csv.replace("<data encoding=\"csv\">", "")
	csv = csv.replace("\n", "").replace("\r", "").replace(" ", "")

	var values: Array = csv.split(",", false)
	if values.size() < width * height:
		printerr("TownMap: 数据不够，预期 %d，实际 %d" % [width * height, values.size()])
		return

	# 4. 构建 TileSet
	var tileset: TileSet = TileSet.new()
	var atlas: TileSetAtlasSource = TileSetAtlasSource.new()

	# 加载贴图
	if not ResourceLoader.exists(tileset_path):
		printerr("TownMap: 找不到 tileset ", tileset_path)
		return

	var tex: Texture2D = load(tileset_path)
	atlas.texture = tex
	atlas.texture_region_size = Vector2i(tile_w, tile_h)
	atlas.margins = Vector2i(0, 0)
	atlas.separation = Vector2i(0, 0)
	atlas.set_name("placeholder")

	# 手动创建每个 tile cell（8个tile）
	for tile_idx in range(8):
		atlas.create_tile(Vector2i(tile_idx, 0), Vector2i(1, 1))

	# 添加物理碰撞层到 tileset
	tileset.add_physics_layer()
	tileset.set_physics_layer_collision_layer(0, 1)

	# 为墙壁(GID=3)、摊位(5)、围栏(7)、树木(8)添加碰撞框
	var collidable_gids: Array = [3, 5, 7, 8]
	var full_tile_polygon: PackedVector2Array = PackedVector2Array([
		Vector2(0, 0),
		Vector2(tile_w, 0),
		Vector2(tile_w, tile_h),
		Vector2(0, tile_h)
	])
	for tile_idx in range(8):
		var gid: int = tile_idx + 1
		if gid in collidable_gids:
			var td: TileData = atlas.get_tile_data(Vector2i(tile_idx, 0), 0)
			if td:
				td.add_collision_polygon(0)
				td.set_collision_polygon_points(0, 0, full_tile_polygon)

	# 添加 source 到 tileset
	var source_id: int = tileset.add_source(atlas)

	# 5b. 应用 tileset
	self.tile_set = tileset

	# 6. 放置每个 tile
	for r in range(height):
		for c in range(width):
			var idx: int = r * width + c
			var gid_str: String = values[idx]
			if gid_str.is_valid_int():
				var gid: int = gid_str.to_int()
				if gid > 0:
					var tile_coords: Vector2i = Vector2i(gid - 1, 0)
					self.set_cell(Vector2i(c, r), source_id, tile_coords)

	# 7. 使地图居中
	var center_offset: Vector2 = Vector2(
		-(width * tile_w) / 2.0,
		-(height * tile_h) / 2.0
	)
	self.position = center_offset

	print("TownMap: 加载完成！")
	_spawn_npcs()

# 在地图加载后生成 NPC
func _spawn_npcs() -> void:
	var npcs = [
		{ "name": "老龙", "pos": Vector2(176, 464), "color": Color(0.827, 0.329, 0), "radius": 96.0, "spd": 80.0, "personality": "脾气暴躁的铁匠，说话直来直去" },
		{ "name": "小娜", "pos": Vector2(272, 528), "color": Color(0.902, 0.494, 0.133), "radius": 80.0, "spd": 70.0, "personality": "温柔害羞的裁缝，说话轻声细语" },
		{ "name": "老强", "pos": Vector2(304, 1104), "color": Color(0.753, 0.224, 0.169), "radius": 96.0, "spd": 60.0, "personality": "爱吹牛的猎人，喜欢夸大其词" },
		{ "name": "阿超", "pos": Vector2(176, 1712), "color": Color(0.153, 0.682, 0.376), "radius": 160.0, "spd": 70.0, "personality": "忠厚老实的农夫，话不多但实在" },
		{ "name": "美", "pos": Vector2(1328, 464), "color": Color(0.557, 0.267, 0.678), "radius": 96.0, "spd": 80.0, "personality": "精明势利的客栈老板娘，见人说人话" },
		{ "name": "雪", "pos": Vector2(1840, 592), "color": Color(0.161, 0.502, 0.725), "radius": 128.0, "spd": 75.0, "personality": "神秘寡言的巫女，说话带玄机" },
		{ "name": "涛", "pos": Vector2(2032, 1776), "color": Color(0.086, 0.627, 0.522), "radius": 192.0, "spd": 90.0, "personality": "游手好闲的酒鬼，说话不着调" },
		{ "name": "小静", "pos": Vector2(1936, 1104), "color": Color(0.173, 0.243, 0.314), "radius": 128.0, "spd": 100.0, "personality": "好奇心旺盛的小女孩，天真烂漫" },
	]

	for n in npcs:
		var npc: GameNPC = npc_scene.instantiate()
		npc.name = n.name
		npc.position = n.pos
		npc.npc_color = n.color
		npc.wander_radius = n.radius
		npc.speed = n.spd
		npc.npc_personality = n.get("personality", "")
		add_child(npc)

	print("TownMap: 已生成 %d 个 NPC" % npcs.size())

# 从文本中解析整数属性
func _parse_int(text: String, attr: String) -> int:
	var idx: int = text.find(attr)
	if idx == -1:
		return 0
	idx += attr.length()
	var end: int = text.find('"', idx)
	var val_str: String = text.substr(idx, end - idx)
	return val_str.to_int()
