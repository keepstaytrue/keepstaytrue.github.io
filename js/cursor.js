(() => {
    // ============================================
    // 工具函数
    // ============================================
    Math.lerp = (a, b, n) => (1 - n) * a + n * b;

    /** 限制数值范围 */
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

    /** 生成随机浮点数 [min, max) */
    const rand = (min, max) => Math.random() * (max - min) + min;

    /** 生成随机整数 [min, max] */
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // ============================================
    // 粒子类
    // ============================================
    class TrailParticle {
        constructor(x, y, hue, speedX = 0, speedY = 0) {
            this.x = x;
            this.y = y;
            this.vx = speedX + rand(-0.8, 0.8);
            this.vy = speedY + rand(-0.8, 0.8);
            this.life = 1.0; // 生命值 1 -> 0
            this.decay = rand(0.015, 0.04); // 衰减速度
            this.hue = hue; // HSL色相
            this.saturation = rand(75, 100);
            this.lightness = rand(50, 65);
            this.size = rand(1.8, 3.5);
            this.alpha = rand(0.7, 1.0);
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= 0.985; // 轻微阻力
            this.vy *= 0.985;
            this.life -= this.decay;
            this.size *= 0.995; // 粒子逐渐缩小
            return this.life > 0;
        }

        draw(ctx) {
            const alpha = this.alpha * this.life;
            if (alpha < 0.02) return;
            ctx.save();
            ctx.globalAlpha = alpha;
            // 发光层
            ctx.shadowColor = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, 0.7)`;
            ctx.shadowBlur = this.size * 2.5;
            ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            // 内核亮点
            ctx.shadowBlur = 0;
            ctx.fillStyle = `hsla(${this.hue}, 60%, 85%, ${alpha * 0.8})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // ============================================
    // 波纹类（点击时产生）
    // ============================================
    class Ripple {
        constructor(x, y, hue) {
            this.x = x;
            this.y = y;
            this.radius = 2;
            this.maxRadius = rand(30, 55);
            this.life = 1.0;
            this.decay = rand(0.025, 0.05);
            this.hue = hue;
            this.lineWidth = rand(1.2, 2.5);
        }

        update() {
            this.radius += (this.maxRadius - this.radius) * 0.15;
            this.life -= this.decay;
            this.lineWidth *= 0.97;
            return this.life > 0 && this.radius < this.maxRadius;
        }

        draw(ctx) {
            const alpha = this.life;
            if (alpha < 0.02) return;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = `hsla(${this.hue}, 90%, 60%, ${alpha})`;
            ctx.lineWidth = this.lineWidth;
            ctx.shadowColor = `hsla(${this.hue}, 100%, 65%, ${alpha * 0.8})`;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.stroke();
            // 第二圈（更细更淡）
            if (this.radius > 8) {
                ctx.globalAlpha = alpha * 0.5;
                ctx.lineWidth = this.lineWidth * 0.5;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius * 0.7, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    // ============================================
    // 主光标类
    // ============================================
    class CyberCursor {
        constructor() {
            // 鼠标位置
            this.rawPos = { x: -100, y: -100 }; // 原始位置
            this.smoothPos = { x: -100, y: -100 }; // 平滑位置
            this.prevRawPos = { x: -100, y: -100 }; // 上一帧原始位置
            this.mouseOnScreen = false;

            // 状态
            this.isHovering = false;
            this.isClicking = false;
            this.clickTimer = 0;

            // 全局色相（用于彩虹拖尾）
            this.globalHue = 0;
            this.hueSpeed = 1.6; // 色相变化速度（度/帧）

            // 粒子 & 波纹
            this.trailParticles = [];
            this.ripples = [];
            this.maxTrailParticles = 150;
            this.maxRipples = 20;

            // 卫星粒子（围绕光标的旋转粒子）
            this.satellites = [];
            this.initSatellites();

            // 创建Canvas
            this.createCanvas();

            // 性能相关
            this.frameCount = 0;
            this.lastHoverCheck = 0;
            this.hoverCheckInterval = 5; // 每5帧检测一次hover

            // 绑定事件
            this.bindEvents();

            // 启动渲染循环
            this.lastTime = performance.now();
            this.renderLoop = this.renderLoop.bind(this);
            requestAnimationFrame(this.renderLoop);

            console.log('%c🚀 Cyber Cursor 已激活 %c| 彩虹拖尾 · 科技风 · 流畅60FPS',
                'color:#00e5ff;font-size:14px;', 'color:#aaa;');
            console.log('%c💡 悬停按钮查看Hover效果 | 点击查看波纹 | 移动感受彩虹拖尾',
                'color:#7c8bff;font-size:12px;');
        }

        initSatellites() {
            const count = 4;
            for (let i = 0; i < count; i++) {
                this.satellites.push({
                    angle: rand(0, Math.PI * 2),
                    radius: rand(9, 18),
                    speed: rand(0.03, 0.07), // 弧度/帧
                    size: rand(1.0, 2.2),
                    hueOffset: rand(0, 60),
                });
            }
        }

        createCanvas() {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'cyber-cursor-canvas';
            this.ctx = this.canvas.getContext('2d');
            document.body.appendChild(this.canvas);
            this.resizeCanvas();
            // 监听窗口大小变化
            this._resizeHandler = () => this.resizeCanvas();
            window.addEventListener('resize', this._resizeHandler);
        }

        resizeCanvas() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2); // 限制DPR以保证性能
            this.canvas.width = window.innerWidth * dpr;
            this.canvas.height = window.innerHeight * dpr;
            this.canvas.style.width = window.innerWidth + 'px';
            this.canvas.style.height = window.innerHeight + 'px';
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(dpr, dpr);
            this.dpr = dpr;
        }

        bindEvents() {
            // 鼠标移动
            document.addEventListener('mousemove', (e) => {
                this.rawPos.x = e.clientX;
                this.rawPos.y = e.clientY;
                if (!this.mouseOnScreen) {
                    this.mouseOnScreen = true;
                    this.smoothPos.x = this.rawPos.x;
                    this.smoothPos.y = this.rawPos.y;
                    this.prevRawPos.x = this.rawPos.x;
                    this.prevRawPos.y = this.rawPos.y;
                }
                // 检测hover（节流）
                if (this.frameCount - this.lastHoverCheck >= this.hoverCheckInterval) {
                    this.lastHoverCheck = this.frameCount;
                    this.checkHover(e.target);
                }
            });

            // 鼠标进入/离开页面
            document.addEventListener('mouseenter', () => {
                this.mouseOnScreen = true;
                this.smoothPos.x = this.rawPos.x;
                this.smoothPos.y = this.rawPos.y;
            });
            document.addEventListener('mouseleave', () => {
                this.mouseOnScreen = false;
                this.isHovering = false;
            });

            // 点击
            document.addEventListener('mousedown', (e) => {
                this.isClicking = true;
                this.clickTimer = 0;
                // 产生点击波纹
                this.spawnClickRipples(e.clientX, e.clientY);
            });
            document.addEventListener('mouseup', () => {
                this.isClicking = false;
            });

            // 触摸设备不启动（可选）
            // document.addEventListener('touchstart', () => { this.mouseOnScreen = false; }, { once: true });
        }

        checkHover(target) {
            if (!target) return;
            try {
                const style = window.getComputedStyle(target);
                const cursor = style.cursor;
                this.isHovering = (cursor === 'pointer' || cursor === 'hand');
            } catch (e) {
                this.isHovering = false;
            }
        }

        spawnClickRipples(x, y) {
            const hue = this.globalHue;
            // 产生2-3个同心波纹
            const count = randInt(2, 3);
            for (let i = 0; i < count; i++) {
                if (this.ripples.length < this.maxRipples) {
                    const ripple = new Ripple(
                        x,
                        y,
                        (hue + i * 30) % 360
                    );
                    ripple.maxRadius = rand(25, 50) * (i + 1) * 0.7;
                    ripple.decay = rand(0.03, 0.06);
                    this.ripples.push(ripple);
                }
            }
            // 同时爆发一些粒子
            const burstCount = randInt(8, 18);
            for (let i = 0; i < burstCount; i++) {
                const angle = rand(0, Math.PI * 2);
                const speed = rand(2, 7);
                const particle = new TrailParticle(
                    x, y,
                    (hue + rand(-20, 20)) % 360,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed
                );
                particle.size = rand(2.5, 4.5);
                particle.decay = rand(0.03, 0.06);
                this.trailParticles.push(particle);
            }
        }

        spawnTrailParticles() {
            if (!this.mouseOnScreen) return;

            const dx = this.rawPos.x - this.prevRawPos.x;
            const dy = this.rawPos.y - this.prevRawPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // 根据移动距离决定粒子数量
            let count = 0;
            if (dist > 0.3) {
                count = clamp(Math.floor(dist * 0.6), 1, 6);
            } else if (this.frameCount % 4 === 0) {
                // 静止时偶尔产生1个粒子保持活力
                count = 1;
            }

            // hover时额外粒子
            if (this.isHovering && dist > 0.5) {
                count += 1;
            }

            for (let i = 0; i < count; i++) {
                if (this.trailParticles.length >= this.maxTrailParticles) {
                    // 移除最老的粒子
                    this.trailParticles.shift();
                }
                const t = i / Math.max(count, 1);
                const px = Math.lerp(this.prevRawPos.x, this.rawPos.x, t);
                const py = Math.lerp(this.prevRawPos.y, this.rawPos.y, t);
                const hue = (this.globalHue + t * 25) % 360;
                const particle = new TrailParticle(
                    px, py, hue,
                    dx * rand(0.05, 0.25),
                    dy * rand(0.05, 0.25)
                );
                // hover时粒子稍大
                if (this.isHovering) {
                    particle.size *= 1.4;
                    particle.saturation = rand(85, 100);
                    particle.lightness = rand(55, 75);
                }
                this.trailParticles.push(particle);
            }
        }

        update() {
            // 更新全局色相
            this.globalHue = (this.globalHue + this.hueSpeed) % 360;

            // 更新平滑位置（lerp缓动）
            const lerpFactor = this.isClicking ? 0.45 : 0.35;
            this.smoothPos.x = Math.lerp(this.smoothPos.x, this.rawPos.x, lerpFactor);
            this.smoothPos.y = Math.lerp(this.smoothPos.y, this.rawPos.y, lerpFactor);

            // 更新卫星粒子角度
            const hoverSpeedMul = this.isHovering ? 1.8 : 1.0;
            for (const sat of this.satellites) {
                sat.angle += sat.speed * hoverSpeedMul;
                if (sat.angle > Math.PI * 2) sat.angle -= Math.PI * 2;
            }

            // 更新拖尾粒子
            for (let i = this.trailParticles.length - 1; i >= 0; i--) {
                if (!this.trailParticles[i].update()) {
                    this.trailParticles.splice(i, 1);
                }
            }

            // 更新波纹
            for (let i = this.ripples.length - 1; i >= 0; i--) {
                if (!this.ripples[i].update()) {
                    this.ripples.splice(i, 1);
                }
            }

            // 点击计时器
            if (this.isClicking) {
                this.clickTimer++;
            }

            // 保存原始位置用于下一帧
            this.prevRawPos.x = this.rawPos.x;
            this.prevRawPos.y = this.rawPos.y;
        }

        drawCursor(ctx, x, y) {
            if (!this.mouseOnScreen) return;

            const t = performance.now() / 1000; // 秒为单位的时间
            const rotAngle = t * 2.5; // 旋转速度 (弧度/秒)
            const hoverScale = this.isHovering ? 1.3 : 1.0;
            const clickScale = this.isClicking ? 0.8 : 1.0;
            const scale = hoverScale * clickScale;
            const baseHue = this.isHovering ? (this.globalHue + 30) % 360 : 195;

            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);

            // --- 外层发光光晕 ---
            const glowGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 18);
            glowGrad.addColorStop(0, `hsla(${baseHue}, 90%, 60%, 0.35)`);
            glowGrad.addColorStop(0.5, `hsla(${baseHue}, 80%, 50%, 0.12)`);
            glowGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.fill();

            // --- 旋转菱形框架 ---
            ctx.save();
            ctx.rotate(rotAngle + Math.PI / 4); // 旋转 + 45度偏移形成菱形
            const halfSize = 8;
            ctx.strokeStyle = `hsla(${baseHue}, 85%, 62%, 0.9)`;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = `hsla(${baseHue}, 100%, 65%, 0.8)`;
            ctx.shadowBlur = 10;
            ctx.strokeRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
            ctx.shadowBlur = 0;
            ctx.restore();

            // --- 内层反向旋转菱形 ---
            ctx.save();
            ctx.rotate(-rotAngle * 0.7 + Math.PI / 4);
            const innerHalf = 4.5;
            ctx.strokeStyle = `hsla(${(baseHue + 40) % 360}, 80%, 70%, 0.7)`;
            ctx.lineWidth = 1.0;
            ctx.shadowColor = `hsla(${(baseHue + 40) % 360}, 90%, 75%, 0.6)`;
            ctx.shadowBlur = 6;
            ctx.strokeRect(-innerHalf, -innerHalf, innerHalf * 2, innerHalf * 2);
            ctx.shadowBlur = 0;
            ctx.restore();

            // --- 中心亮点 ---
            const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 3.5);
            coreGrad.addColorStop(0, 'rgba(255,255,255,1)');
            coreGrad.addColorStop(0.3, 'rgba(255,255,255,0.85)');
            coreGrad.addColorStop(0.7, `hsla(${baseHue}, 60%, 80%, 0.4)`);
            coreGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // --- 十字刻度标记（瞄准镜风格）---
            const tickLen = 5;
            const tickGap = 9;
            ctx.strokeStyle = `hsla(${baseHue}, 70%, 75%, 0.7)`;
            ctx.lineWidth = 1.2;
            ctx.shadowColor = `hsla(${baseHue}, 80%, 70%, 0.5)`;
            ctx.shadowBlur = 3;
            ctx.beginPath();
            // 上
            ctx.moveTo(0, -tickGap);
            ctx.lineTo(0, -tickGap - tickLen);
            // 下
            ctx.moveTo(0, tickGap);
            ctx.lineTo(0, tickGap + tickLen);
            // 左
            ctx.moveTo(-tickGap, 0);
            ctx.lineTo(-tickGap - tickLen, 0);
            // 右
            ctx.moveTo(tickGap, 0);
            ctx.lineTo(tickGap + tickLen, 0);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // --- 卫星粒子 ---
            for (const sat of this.satellites) {
                const sx = Math.cos(sat.angle) * sat.radius;
                const sy = Math.sin(sat.angle) * sat.radius;
                const satHue = (baseHue + sat.hueOffset) % 360;
                ctx.fillStyle = `hsla(${satHue}, 80%, 70%, 0.85)`;
                ctx.shadowColor = `hsla(${satHue}, 90%, 65%, 0.7)`;
                ctx.shadowBlur = 5;
                ctx.beginPath();
                ctx.arc(sx, sy, sat.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            ctx.restore(); // 恢复translate/scale
        }

        renderLoop(timestamp) {
            const ctx = this.ctx;
            const w = window.innerWidth;
            const h = window.innerHeight;

            // 清除画布
            ctx.clearRect(0, 0, w, h);

            // 生成拖尾粒子
            this.spawnTrailParticles();

            // 更新所有元素
            this.update();

            // 绘制拖尾粒子（在光标下方）
            for (const particle of this.trailParticles) {
                particle.draw(ctx);
            }

            // 绘制波纹
            for (const ripple of this.ripples) {
                ripple.draw(ctx);
            }

            // 绘制主光标
            this.drawCursor(ctx, this.smoothPos.x, this.smoothPos.y);

            // 帧计数
            this.frameCount++;
            this.lastTime = timestamp;

            requestAnimationFrame(this.renderLoop);
        }

        /** 手动刷新（重新初始化粒子等） */
        refresh() {
            this.trailParticles = [];
            this.ripples = [];
            this.satellites = [];
            this.initSatellites();
            this.globalHue = 0;
            this.isHovering = false;
            this.isClicking = false;
            console.log('%c🔄 Cyber Cursor 已刷新', 'color:#ffab00;');
        }
    }

    // ============================================
    // 启动
    // ============================================
    const cyberCursor = new CyberCursor();

    // 暴露到全局，方便手动刷新
    window.CyberCursor = cyberCursor;
    // 使用方式：在控制台执行 window.CyberCursor.refresh() 即可刷新

    console.log('%c✨ 彩虹拖尾科技光标已就绪 %c| 尽情享受吧~',
        'color:#ff4081;font-size:14px;', 'color:#aaa;');
    console.log('%c🖱 移动鼠标 → 彩虹拖尾 | 🎯 悬停按钮 → Hover变形 | 👆 点击 → 波纹爆发',
        'color:#7c8bff;');
})();