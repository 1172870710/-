extends CharacterBody2D
class_name GameNPC

# ============================================
# NPC — 彩色方块 + 漫游 + 碰撞 + 完整对话
# ============================================

@export var speed: float = 80.0
@export var npc_color: Color = Color(0.8, 0.4, 0.2)
@export var wander_radius: float = 160.0
@export var home_position: Vector2
@export var npc_personality: String = ""

# 漫游状态机
enum State { IDLE, WALKING, PAUSED }
var _state: int = State.IDLE
var _target_pos: Vector2
var _state_timer: float = 0.0
var _next_state_time: float = 0.0
var _stuck_timer: float = 0.0
var _last_pos: Vector2

# 占位精灵
var _sprite: ColorRect

# 交互系统
var _interaction_area: Area2D
var _player_in_range: bool = false

# 对话状态
enum DialogState { NONE, GREETING, TALKING }
var _dialog_state: int = DialogState.NONE
var _waiting_response: bool = false
static var _any_dialogue_active: bool = false
static var any_conversation_active: bool = false

# 对话历史（用于 API 多轮上下文）
var _conversation_history: Array = []
var _system_prompt: String = ""

# 对话气泡（世界空间）
var _speech_bg: ColorRect
var _speech_label: Label
var _prompt_label: Label

# 输入 UI（屏幕空间 CanvasLayer，始终在最上层）
var _input_canvas: CanvasLayer
var _input_panel: Panel
var _input_field: LineEdit

# DeepSeek API
const ApiConfig = preload("res://scripts/ai/api_config.gd")
var _http: HTTPRequest


# ============================
# 生命周期
# ============================

func _ready() -> void:
	if home_position == Vector2.ZERO:
		home_position = global_position

	_sprite = ColorRect.new()
	_sprite.color = npc_color
	_sprite.size = Vector2(28, 28)
	_sprite.position = Vector2(-14, -14)
	add_child(_sprite)

	var shape: CollisionShape2D = CollisionShape2D.new()
	var rect: RectangleShape2D = RectangleShape2D.new()
	rect.size = Vector2(24, 24)
	shape.shape = rect
	add_child(shape)

	_setup_interaction()
	_setup_ui()
	_setup_http()
	_pick_new_target()

func _setup_interaction() -> void:
	_interaction_area = Area2D.new()
	var area_shape: CollisionShape2D = CollisionShape2D.new()
	var circle: CircleShape2D = CircleShape2D.new()
	circle.radius = 48.0
	area_shape.shape = circle
	_interaction_area.add_child(area_shape)
	_interaction_area.collision_layer = 0
	_interaction_area.collision_mask = 1
	add_child(_interaction_area)
	_interaction_area.body_entered.connect(_on_interaction_body_entered)
	_interaction_area.body_exited.connect(_on_interaction_body_exited)

func _setup_ui() -> void:
	_speech_bg = ColorRect.new()
	_speech_bg.color = Color(1, 1, 1, 0.9)
	_speech_bg.size = Vector2(240, 60)
	_speech_bg.position = Vector2(-120, -90)
	_speech_bg.visible = false
	add_child(_speech_bg)

	_speech_label = Label.new()
	_speech_label.size = Vector2(220, 50)
	_speech_label.position = Vector2(-110, -85)
	_speech_label.add_theme_color_override("font_color", Color(0, 0, 0))
	_speech_label.add_theme_font_size_override("font_size", 22)
	_speech_label.autowrap_mode = TextServer.AUTOWRAP_WORD
	_speech_label.visible = false
	add_child(_speech_label)

	_prompt_label = Label.new()
	_prompt_label.text = "[T] 对话"
	_prompt_label.position = Vector2(-54, -65)
	_prompt_label.add_theme_color_override("font_color", Color(1, 1, 0))
	_prompt_label.add_theme_font_size_override("font_size", 22)
	_prompt_label.visible = false
	add_child(_prompt_label)

func _setup_http() -> void:
	_http = HTTPRequest.new()
	_http.name = "HTTPRequest"
	_http.timeout = 10
	add_child(_http)
	_http.request_completed.connect(_on_http_request_completed)


# ============================
# 物理更新（漫游 + 对话暂停）
# ============================

func _physics_process(delta: float) -> void:
	# 提示文字：仅当玩家在范围内且不在对话中才显示
	_prompt_label.visible = _player_in_range and _dialog_state == DialogState.NONE

	# 对话进行中 → NPC 原地不动
	if _dialog_state != DialogState.NONE:
		velocity = Vector2.ZERO
		return

	# 漫游状态机
	_state_timer += delta

	match _state:
		State.IDLE:
			velocity = Vector2.ZERO
			if _state_timer >= _next_state_time:
				_pick_new_target()

		State.WALKING:
			var dir: Vector2 = global_position.direction_to(_target_pos)
			var dist: float = global_position.distance_to(_target_pos)

			if dist < 4.0:
				_set_state(State.PAUSED, randf_range(1.0, 3.0))
			else:
				velocity = dir * speed
				move_and_slide()

				if global_position.distance_to(_last_pos) < 1.0:
					_stuck_timer += delta
					if _stuck_timer > 1.5:
						_pick_new_target()
				else:
					_stuck_timer = 0.0

				_last_pos = global_position

				if _state_timer >= _next_state_time:
					_pick_new_target()

		State.PAUSED:
			velocity = Vector2.ZERO
			if _state_timer >= _next_state_time:
				_pick_new_target()


# ============================
# 输入
# ============================

func _input(event: InputEvent) -> void:
	# 对话中按 Esc 结束
	if _dialog_state != DialogState.NONE and event is InputEventKey and event.keycode == KEY_ESCAPE and event.pressed and not event.echo:
		_end_conversation()
		get_viewport().set_input_as_handled()
		return

	# 按 T 开始对话
	if event is InputEventKey and event.keycode == KEY_T and event.pressed and not event.echo:
		if _player_in_range and _dialog_state == DialogState.NONE and not _any_dialogue_active:
			_start_conversation()
			get_viewport().set_input_as_handled()
			return


# ============================
# 交互回调
# ============================

func _on_interaction_body_entered(body: Node) -> void:
	if body is Player:
		_player_in_range = true

func _on_interaction_body_exited(body: Node) -> void:
	if body is Player:
		_player_in_range = false
		if _dialog_state != DialogState.NONE:
			_end_conversation()


# ============================
# 对话流程
# ============================

func _start_conversation() -> void:
	_any_dialogue_active = true
	any_conversation_active = true
	_dialog_state = DialogState.GREETING
	_waiting_response = true

	# 构建 NPC 人格上下文
	_system_prompt = "你是一个游戏NPC，名字叫" + name + "。"
	if npc_personality != "":
		_system_prompt += "性格：" + npc_personality + "。"
	_system_prompt += "和面前的玩家对话，每次回复不超过30字，不要加引号。保持语气符合你的性格。"

	_conversation_history.clear()

	_show_input_ui()
	_show_speech("...")
	_call_api("对面前的玩家打个招呼吧。")

func _on_input_submitted(text: String) -> void:
	if text.strip_edges() == "" or _waiting_response:
		return
	_waiting_response = true
	_input_field.editable = false
	_input_field.placeholder_text = "等待回复..."

	_conversation_history.append({"role": "user", "content": text.strip_edges()})
	_input_field.clear()
	_show_speech("...")
	_call_api(text.strip_edges())

func _end_conversation() -> void:
	_dialog_state = DialogState.NONE
	_waiting_response = false
	_any_dialogue_active = false
	any_conversation_active = false
	_conversation_history.clear()
	_hide_speech()
	_hide_input_ui()

func _call_api(user_message: String) -> void:
	var messages: Array = [
		{"role": "system", "content": _system_prompt}
	]
	for msg in _conversation_history:
		messages.append(msg)
	# 当前用户消息还没进 history（首次问候也在这里）
	messages.append({"role": "user", "content": user_message})

	var body_json = JSON.new().stringify({
		"model": "deepseek-chat",
		"messages": messages,
		"max_tokens": 60,
		"temperature": 0.8
	})

	var headers: PackedStringArray = [
		"Content-Type: application/json",
		"Authorization: Bearer " + ApiConfig.DEEPSEEK_API_KEY
	]

	var err = _http.request(ApiConfig.DEEPSEEK_API_URL, headers, HTTPClient.METHOD_POST, body_json)
	if err != OK:
		_show_speech("（信号不好）")
		_waiting_response = false
		_input_field.editable = true
		_input_field.grab_focus()

func _on_http_request_completed(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	if code != 200 or result != HTTPRequest.RESULT_SUCCESS:
		_show_speech("（NPC走神了）")
	else:
		var json = JSON.new()
		var parse_err = json.parse(body.get_string_from_utf8())
		if parse_err == OK:
			var data = json.get_data()
			if data.has("choices") and data.choices.size() > 0:
				var text: String = data.choices[0].message.content
				text = text.strip_edges().trim_prefix("\"").trim_suffix("\"").trim_prefix("「").trim_suffix("」")
				_show_speech(text)
				_conversation_history.append({"role": "assistant", "content": text})
			else:
				_show_speech("...")
		else:
			_show_speech("...")

	_dialog_state = DialogState.TALKING
	_waiting_response = false
	if _input_field:
		_input_field.editable = true
		_input_field.placeholder_text = "打字回复，Enter 发送..."
		_input_field.grab_focus()


# ============================
# 输入 UI（屏幕空间）
# ============================

func _show_input_ui() -> void:
	_input_canvas = CanvasLayer.new()
	_input_canvas.layer = 100
	add_child(_input_canvas)

	var vs: Vector2i = get_viewport().size if get_viewport() else Vector2i(1280, 720)

	_input_panel = Panel.new()
	_input_panel.size = Vector2(500, 44)
	_input_panel.position = Vector2(vs.x / 2.0 - 250, vs.y - 80)
	_input_canvas.add_child(_input_panel)

	_input_field = LineEdit.new()
	_input_field.size = Vector2(480, 30)
	_input_field.position = Vector2(10, 7)
	_input_field.placeholder_text = "打字回复，Enter 发送..."
	_input_field.add_theme_color_override("font_color", Color(0, 0, 0))
	_input_panel.add_child(_input_field)
	_input_field.text_submitted.connect(_on_input_submitted)
	_input_field.grab_focus()

func _hide_input_ui() -> void:
	if _input_canvas:
		_input_canvas.queue_free()
		_input_canvas = null
		_input_panel = null
		_input_field = null


# ============================
# 气泡显示
# ============================

func _show_speech(text: String) -> void:
	# 估算宽度：中文字符约等于字号大小
	var est_w: int = clampi(text.length() * 18, 80, 400)
	_speech_label.size.x = est_w
	_speech_label.text = text

	# 获取实际换行后的行数，计算高度
	var line_count: int = maxi(_speech_label.get_line_count(), 1)
	var line_h: int = 30  # 字号22 + 行间距
	var content_h: int = line_count * line_h + 8
	var bg_w: int = est_w + 24
	var bg_h: int = content_h + 4

	# 底部固定，气泡向上生长
	_speech_bg.size = Vector2(bg_w, bg_h)
	_speech_bg.position = Vector2(-bg_w / 2, -30 - bg_h)
	_speech_label.size = Vector2(est_w, content_h)
	_speech_label.position = Vector2(-est_w / 2, -26 - bg_h)

	_speech_bg.visible = true
	_speech_label.visible = true

func _hide_speech() -> void:
	_speech_label.text = ""
	_speech_bg.visible = false
	_speech_label.visible = false


# ============================
# 漫游
# ============================

func _pick_new_target() -> void:
	var offset_x: float = randf_range(-wander_radius, wander_radius)
	var offset_y: float = randf_range(-wander_radius, wander_radius)
	_target_pos = home_position + Vector2(offset_x, offset_y)
	_set_state(State.WALKING, randf_range(1.0, 4.0))

func _set_state(new_state: int, duration: float) -> void:
	_state = new_state
	_state_timer = 0.0
	_next_state_time = duration
	_stuck_timer = 0.0
	_last_pos = global_position
	if new_state == State.IDLE or new_state == State.PAUSED:
		velocity = Vector2.ZERO
