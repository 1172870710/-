extends CharacterBody2D
class_name Enemy

# ============================================
# 敌人 — AnimatedSprite2D + 巡逻/追击/战斗
# ============================================

@export var speed: float = 60.0
@export var hp: int = 3
@export var max_hp: int = 3
@export var damage: int = 1
@export var aggro_range: float = 120.0
@export var attack_range: float = 28.0
@export var patrol_radius: float = 120.0
@export var enemy_color: Color = Color(0.85, 0.15, 0.15)

# 状态机
enum State { IDLE, PATROL, CHASE, ATTACK, HURT, DEAD }
var _state: int = State.IDLE
var _state_timer: float = 0.0
var _next_state_time: float = 0.0
var _target_pos: Vector2
var _home_pos: Vector2
var _stuck_timer: float = 0.0
var _last_pos: Vector2

# 引用
var _animated_sprite: AnimatedSprite2D
var _player_ref: Player = null


# ============================
# 生命周期
# ============================

func _ready() -> void:
	_home_pos = global_position
	_setup_animated_sprite()
	_setup_collision()
	_pick_new_patrol_target()


func _setup_animated_sprite() -> void:
	_animated_sprite = AnimatedSprite2D.new()
	_animated_sprite.name = "AnimatedSprite2D"

	var frames := SpriteFrames.new()
	var anim_names := ["idle", "walk", "attack", "hurt", "dead"]
	for anim in anim_names:
		frames.add_animation(anim)

	var tex_size := Vector2i(28, 28)

	# idle — 1帧
	frames.add_frame("idle", _make_placeholder_tex(tex_size, enemy_color))
	frames.set_animation_speed("idle", 1.0)
	frames.set_animation_loop("idle", true)

	# walk — 2帧，循环
	for i in 2:
		var c = enemy_color
		c = c.lightened(0.1 * i)
		frames.add_frame("walk", _make_placeholder_tex(tex_size, c))
	frames.set_animation_speed("walk", 5.0)
	frames.set_animation_loop("walk", true)

	# attack — 1帧亮红
	frames.add_frame("attack", _make_placeholder_tex(tex_size, Color(1.0, 0.3, 0.3)))
	frames.set_animation_speed("attack", 1.0)
	frames.set_animation_loop("attack", false)

	# hurt — 1帧白
	frames.add_frame("hurt", _make_placeholder_tex(tex_size, Color.WHITE))
	frames.set_animation_speed("hurt", 1.0)
	frames.set_animation_loop("hurt", false)

	# dead — 1帧暗红
	frames.add_frame("dead", _make_placeholder_tex(tex_size, Color(0.25, 0.0, 0.0)))
	frames.set_animation_speed("dead", 1.0)
	frames.set_animation_loop("dead", false)

	_animated_sprite.sprite_frames = frames
	_animated_sprite.animation = "idle"
	_animated_sprite.centered = true
	_animated_sprite.play()
	add_child(_animated_sprite)


func _make_placeholder_tex(size: Vector2i, color: Color) -> Texture2D:
	var image := Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	image.fill(color)
	# 黑色边框
	var w := size.x - 1
	var h := size.y - 1
	for x in size.x:
		image.set_pixel(x, 0, Color.BLACK)
		image.set_pixel(x, h, Color.BLACK)
	for y in size.y:
		image.set_pixel(0, y, Color.BLACK)
		image.set_pixel(w, y, Color.BLACK)
	# 眼睛（两个小白点）
	var eye_y := size.y / 3
	var eye_x_l := size.x / 3
	var eye_x_r := size.x * 2 / 3
	image.set_pixel(eye_x_l, eye_y, Color.WHITE)
	image.set_pixel(eye_x_r, eye_y, Color.WHITE)
	return ImageTexture.create_from_image(image)


func _setup_collision() -> void:
	var shape := CollisionShape2D.new()
	shape.name = "CollisionShape2D"
	var rect := RectangleShape2D.new()
	rect.size = Vector2(22, 22)
	shape.shape = rect
	add_child(shape)


# ============================
# 主循环
# ============================

func _physics_process(delta: float) -> void:
	match _state:
		State.DEAD:
			velocity = Vector2.ZERO
			return

		State.HURT:
			velocity = Vector2.ZERO
			_state_timer += delta
			if _state_timer >= _next_state_time:
				_change_state(State.IDLE if hp <= 0 else State.PATROL)
				if hp <= 0:
					_die()
			return

		State.ATTACK:
			velocity = Vector2.ZERO
			_state_timer += delta
			if _state_timer >= _next_state_time:
				_change_state(State.CHASE)
			return

		State.CHASE:
			_chase_player(delta)

		State.PATROL:
			_patrol(delta)

		State.IDLE:
			velocity = Vector2.ZERO
			_state_timer += delta
			if _state_timer >= _next_state_time:
				_pick_new_patrol_target()

	# 检测玩家进入警戒范围
	_detect_player()

	move_and_slide()


# ============================
# 行为
# ============================

func _detect_player() -> void:
	if _state in [State.DEAD, State.HURT, State.ATTACK]:
		return

	var players := get_tree().get_nodes_in_group("player")
	if players.is_empty():
		return

	var p: Node2D = players[0]
	var dist := global_position.distance_to(p.global_position)

	if dist <= aggro_range:
		if _state != State.CHASE:
			_change_state(State.CHASE)
		_player_ref = p
	elif _state == State.CHASE:
		_player_ref = null
		_change_state(State.PATROL)
		_home_pos = global_position


func _chase_player(_delta: float) -> void:
	if not is_instance_valid(_player_ref):
		_player_ref = null
		_change_state(State.PATROL)
		return

	var dist := global_position.distance_to(_player_ref.global_position)

	if dist <= attack_range:
		_change_state(State.ATTACK)
		_play_anim("attack")
		_attack_player()
		return

	var dir := global_position.direction_to(_player_ref.global_position)
	velocity = dir * speed

	# 防卡死
	_stuck_timer += _delta
	if global_position.distance_to(_last_pos) < 2.0:
		if _stuck_timer > 1.5:
			_change_state(State.PATROL)
			_stuck_timer = 0.0
	else:
		_stuck_timer = 0.0
	_last_pos = global_position

	_play_anim("walk")


func _patrol(_delta: float) -> void:
	var dir := global_position.direction_to(_target_pos)
	var dist := global_position.distance_to(_target_pos)

	if dist < 4.0:
		_change_state(State.IDLE, randf_range(1.0, 3.0))
		_play_anim("idle")
	else:
		velocity = dir * speed * 0.5
		_state_timer += _delta
		if _state_timer >= _next_state_time:
			_pick_new_patrol_target()
		_play_anim("walk")


func _pick_new_patrol_target() -> void:
	var offset := Vector2(
		randf_range(-patrol_radius, patrol_radius),
		randf_range(-patrol_radius, patrol_radius)
	)
	_target_pos = _home_pos + offset
	_change_state(State.PATROL, randf_range(2.0, 5.0))


func _change_state(new_state: int, duration: float = 0.0) -> void:
	_state = new_state
	_state_timer = 0.0
	_next_state_time = duration
	_stuck_timer = 0.0
	_last_pos = global_position


func _play_anim(anim_name: String) -> void:
	if _animated_sprite and _animated_sprite.animation != anim_name:
		_animated_sprite.play(anim_name)


# ============================
# 战斗
# ============================

func _attack_player() -> void:
	if not is_instance_valid(_player_ref):
		return
	print(name, " 攻击了玩家！")
	# TODO: 后续接入伤害系统，调用 Player.take_damage(damage)
	_next_state_time = 0.8


func take_damage(amount: int) -> void:
	if _state == State.DEAD:
		return

	hp -= amount
	print(name, " 受到 ", amount, " 点伤害，剩余 HP: ", hp)

	_change_state(State.HURT, 0.3)
	_play_anim("hurt")

	if hp <= 0:
		_die()


func _die() -> void:
	_change_state(State.DEAD)
	_play_anim("dead")
	# 碰撞层移到忽略层，不再阻挡
	collision_layer = 0
	collision_mask = 0
	print(name, " 被击败")

	# 一段时间后移除
	var tween := create_tween()
	tween.tween_property(self, "modulate", Color(1, 1, 1, 0), 2.0)
	tween.tween_callback(queue_free)
