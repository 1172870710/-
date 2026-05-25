extends CharacterBody2D
class_name Player

# ============================================
# 可操控角色 — 波风水门
# WASD / 方向键移动，AnimatedSprite2D 播放序列帧
# 节点结构仿照 NPC 场景（OcadNpc/Shadow/AnimatedSprite2D）
# ============================================

@export var speed: float = 160.0

@onready var _animated_sprite: AnimatedSprite2D = $OcadNpc/AnimatedSprite2D

# 当前朝向（用于 idle 时恢复）
var _last_dir: Vector2 = Vector2.DOWN


func _ready() -> void:
	add_to_group("player")
	_animated_sprite.play("idledown")


func _physics_process(_delta: float) -> void:
	# 对话中锁定移动
	if GameNPC.any_conversation_active:
		velocity = Vector2.ZERO
		_animated_sprite.play("idle" + _dir_to_suffix(_last_dir))
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

	# 更新动画
	if dir == Vector2.ZERO:
		var anim: String = "idle" + _dir_to_suffix(_last_dir)
		if _animated_sprite.sprite_frames.has_animation(anim):
			_animated_sprite.play(anim)
	else:
		_last_dir = dir
		var anim: String = "walk" + _dir_to_suffix(dir)
		if _animated_sprite.sprite_frames.has_animation(anim):
			_animated_sprite.play(anim)

	# 左右翻转（精灵只有朝左的帧，朝右时水平翻转）
	if dir.x > 0:
		_animated_sprite.flip_h = true
	elif dir.x < 0:
		_animated_sprite.flip_h = false
	elif _last_dir.x > 0:
		_animated_sprite.flip_h = true
	else:
		_animated_sprite.flip_h = false


# 将方向向量转为动画名后缀（匹配 NPC SpriteFrames 命名）
func _dir_to_suffix(d: Vector2) -> String:
	if abs(d.x) > abs(d.y):
		return "L"  # 左/右都用 L（通过 flip_h 区分）
	elif abs(d.y) > 0:
		return "down" if d.y > 0 else "up"
	return "down"
