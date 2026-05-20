extends CharacterBody2D
class_name Player

# ============================================
# 可操控角色 — 占位版
# WASD / 方向键移动，占位为彩色矩形
# ============================================

@export var speed: float = 160.0

# 占位精灵
var _sprite: ColorRect

func _ready() -> void:
	# 创建占位精灵（32×32 蓝色方块）
	_sprite = ColorRect.new()
	_sprite.color = Color(0.2, 0.5, 0.9)
	_sprite.size = Vector2(28, 28)
	_sprite.position = Vector2(-14, -14)
	add_child(_sprite)

	# 碰撞检测体
	var shape: CollisionShape2D = CollisionShape2D.new()
	var rect: RectangleShape2D = RectangleShape2D.new()
	rect.size = Vector2(24, 24)
	shape.shape = rect
	add_child(shape)

func _physics_process(_delta: float) -> void:
	# 对话中锁定移动
	if GameNPC.any_conversation_active:
		velocity = Vector2.ZERO
		return

	var dir: Vector2 = Vector2.ZERO

	if Input.is_action_pressed("ui_left") or Input.is_key_pressed(KEY_A):
		dir.x -= 1
	if Input.is_action_pressed("ui_right") or Input.is_key_pressed(KEY_D):
		dir.x += 1
	if Input.is_action_pressed("ui_up") or Input.is_key_pressed(KEY_W):
		dir.y -= 1
	if Input.is_action_pressed("ui_down") or Input.is_key_pressed(KEY_S):
		dir.y += 1

	# 归一化对角线
	if dir.length() > 1:
		dir = dir.normalized()

	velocity = dir * speed
	move_and_slide()
