// 实体（玩家/NPC）渲染器
const TILE_SIZE = 32;
const ENTITY_SIZE = 28;

class EntityRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    // 动画帧计数
    this.animFrame = 0;
  }

  // 绘制玩家
  drawPlayer(player, camera) {
    const screenX = player.x - ENTITY_SIZE / 2 - camera.x;
    const screenY = player.y - ENTITY_SIZE / 2 - camera.y;
    const { ctx } = this.renderer;

    // 绘制名字标签
    this.renderer.drawText(
      player.name,
      screenX + ENTITY_SIZE / 2 - player.name.length * 4,
      screenY - 8,
      '#fff',
      8
    );

    // 绘制身体
    ctx.fillStyle = player.color;
    ctx.fillRect(Math.round(screenX), Math.round(screenY), ENTITY_SIZE, ENTITY_SIZE);

    // 眼睛（根据朝向）
    ctx.fillStyle = '#fff';
    const eyeY = Math.round(screenY) + 8;
    if (player.dir === 'down' || !player.dir) {
      ctx.fillRect(Math.round(screenX) + 6, eyeY + 8, 6, 6);
      ctx.fillRect(Math.round(screenX) + 16, eyeY + 8, 6, 6);
    } else if (player.dir === 'up') {
      ctx.fillRect(Math.round(screenX) + 6, eyeY, 6, 6);
      ctx.fillRect(Math.round(screenX) + 16, eyeY, 6, 6);
    } else if (player.dir === 'left') {
      ctx.fillRect(Math.round(screenX) + 4, eyeY + 2, 6, 6);
      ctx.fillRect(Math.round(screenX) + 4, eyeY + 12, 6, 6);
    } else if (player.dir === 'right') {
      ctx.fillRect(Math.round(screenX) + 18, eyeY + 2, 6, 6);
      ctx.fillRect(Math.round(screenX) + 18, eyeY + 12, 6, 6);
    }

    // 瞳孔
    ctx.fillStyle = '#000';
    if (player.dir === 'down' || !player.dir) {
      ctx.fillRect(Math.round(screenX) + 8, eyeY + 10, 2, 2);
      ctx.fillRect(Math.round(screenX) + 18, eyeY + 10, 2, 2);
    } else if (player.dir === 'up') {
      ctx.fillRect(Math.round(screenX) + 8, eyeY + 2, 2, 2);
      ctx.fillRect(Math.round(screenX) + 18, eyeY + 2, 2, 2);
    } else if (player.dir === 'left') {
      ctx.fillRect(Math.round(screenX) + 6, eyeY + 4, 2, 2);
      ctx.fillRect(Math.round(screenX) + 6, eyeY + 14, 2, 2);
    } else if (player.dir === 'right') {
      ctx.fillRect(Math.round(screenX) + 20, eyeY + 4, 2, 2);
      ctx.fillRect(Math.round(screenX) + 20, eyeY + 14, 2, 2);
    }

    // 走路动画
    if (player.moving) {
      const footOffset = Math.floor(this.animFrame / 8) % 2 === 0 ? 2 : 0;
      ctx.fillStyle = '#000';
      ctx.fillRect(Math.round(screenX) + 6 + footOffset, Math.round(screenY) + ENTITY_SIZE, 6, 4);
      ctx.fillRect(Math.round(screenX) + 18 - footOffset, Math.round(screenY) + ENTITY_SIZE, 6, 4);
    }
  }

  updateAnimation() {
    this.animFrame++;
  }
}

export default EntityRenderer;
