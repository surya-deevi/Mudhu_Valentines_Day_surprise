import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, signal, viewChild, afterNextRender, effect } from '@angular/core';

interface Heart {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  update: () => void;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  life: number;
  maxLife: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnDestroy {
  // --- View Children ---
  bgCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('bgCanvas');
  noWrapper = viewChild<ElementRef<HTMLDivElement>>('noWrapper');
  yesBtn = viewChild<ElementRef<HTMLButtonElement>>('yesBtn');
  successCanvas = viewChild<ElementRef<HTMLCanvasElement>>('successCanvas');

  // --- Signals for State Management ---
  userName = signal('Cutie');
  loadingProgress = signal(0);
  loadingStatus = signal('Initializing...');
  isLoading = signal(true);
  cardVisible = signal(false);
  currentScreen = signal<'proposal' | 'ask' | 'success'>('proposal');
  
  yesButtonScale = signal(1);
  noButtonPosition = signal<{ position: string, left: string, top: string, transform: string } | null>(null);
  isNoButtonRunning = signal(false);

  // --- Private Properties ---
  private readonly statusMsgs = ["Initializing Romance...", "Checking Vibe Levels...", "Analyzing Heart Rate...", "Syncing Cupid's Arrows...", "Optimizing Cuteness...", "Ready!"];
  private loadingInterval: any;
  private hearts: Heart[] = [];
  private particles: Particle[] = [];
  private animationFrameId: number | null = null;
  private successAnimationFrameId: number | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private successCanvasContext: CanvasRenderingContext2D | null = null;
  
  constructor() {
    afterNextRender(() => {
      this.initialize();
    });

    effect(() => {
      if (this.currentScreen() === 'success') {
        // This effect runs after the view is updated, so the successCanvas will be available.
        this.initSuccessAnimation();
      }
    });
  }

  initialize() {
    const urlParams = new URLSearchParams(window.location.search);
    const nameFromUrl = urlParams.get('name');
    if (nameFromUrl) {
      this.userName.set(nameFromUrl);
    }
    this.startLoadingSequence();
  }

  startLoadingSequence() {
    this.loadingInterval = setInterval(() => {
      this.loadingProgress.update(p => {
        let newProgress = p + Math.random() * 15;
        if (newProgress > 100) newProgress = 100;
        
        const msgIndex = Math.floor((newProgress / 100) * (this.statusMsgs.length - 1));
        this.loadingStatus.set(this.statusMsgs[msgIndex]);
        
        if (newProgress === 100) {
          clearInterval(this.loadingInterval);
          setTimeout(() => {
            this.isLoading.set(false);
            setTimeout(() => {
              this.cardVisible.set(true);
              this.initCanvas();
            }, 500);
          }, 800);
        }
        return newProgress;
      });
    }, 200);
  }
  
  initCanvas() {
    const canvas = this.bgCanvas().nativeElement;
    this.canvasContext = canvas.getContext('2d');
    if (!this.canvasContext) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    this.hearts = [];
    for (let i = 0; i < 30; i++) {
        const heart: Heart = {
            x: Math.random() * canvas.width,
            y: canvas.height + 50,
            size: Math.random() * 10 + 10,
            speed: Math.random() * 2 + 1,
            opacity: Math.random() * 0.5 + 0.2,
            update: function() {
                this.y -= this.speed;
                if (this.y < -50) this.y = canvas.height + 50;
            },
            draw: function(ctx: CanvasRenderingContext2D) {
                ctx.globalAlpha = this.opacity;
                ctx.fillStyle = '#ff4d6d';
                ctx.font = `${this.size}px Arial`;
                ctx.fillText('❤️', this.x, this.y);
            }
        };
        this.hearts.push(heart);
    }

    const animate = () => {
      if (!this.canvasContext) return;
      this.canvasContext.clearRect(0, 0, canvas.width, canvas.height);
      this.hearts.forEach(h => {
        h.update();
        h.draw(this.canvasContext!);
      });
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  goToAskScreen() {
    this.currentScreen.set('ask');
  }

  celebrate() {
    this.currentScreen.set('success');
    this.hearts.forEach(h => {
      h.speed *= 3;
      h.opacity = 1;
    });
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  }
  
  @HostListener('window:resize')
  onResize() {
    if (this.bgCanvas() && this.canvasContext) {
      const canvas = this.bgCanvas().nativeElement;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    if (this.successCanvas() && this.successCanvasContext) {
      const canvas = this.successCanvas()!.nativeElement;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.currentScreen() === 'ask') {
      this.runAway(event.clientX, event.clientY);
    } else if (this.currentScreen() === 'success') {
      this.createParticlesAt(event.clientX, event.clientY, 5);
      if (!this.successAnimationFrameId && this.particles.length > 0) {
        this.animateSuccess();
      }
    }
  }

  @HostListener('window:touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    if (this.currentScreen() === 'ask') {
      this.runAway(event.touches[0].clientX, event.touches[0].clientY);
    } else if (this.currentScreen() === 'success') {
      this.createParticlesAt(event.touches[0].clientX, event.touches[0].clientY, 5);
      if (!this.successAnimationFrameId && this.particles.length > 0) {
        this.animateSuccess();
      }
    }
  }

  private runAway(pointerX: number, pointerY: number) {
    if (this.currentScreen() !== 'ask') return;
    
    const noWrapperEl = this.noWrapper()?.nativeElement;
    const yesBtnEl = this.yesBtn()?.nativeElement;
    if (!noWrapperEl || !yesBtnEl) return;

    const rect = noWrapperEl.getBoundingClientRect();
    const yesRect = yesBtnEl.getBoundingClientRect();

    const btnCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };

    const dist = Math.hypot(pointerX - btnCenter.x, pointerY - btnCenter.y);

    if (dist < 130) {
      this.isNoButtonRunning.set(true);

      const zoneW = window.innerWidth * 0.75;
      const zoneH = window.innerHeight * 0.75;
      const startX = (window.innerWidth - zoneW) / 2;
      const startY = (window.innerHeight - zoneH) / 2;
      
      const maxX = zoneW - rect.width;
      const maxY = zoneH - rect.height;
      
      const newX = startX + (Math.random() * maxX);
      const newY = startY + (Math.random() * maxY);

      this.noButtonPosition.set({
        position: 'fixed',
        left: `${newX}px`,
        top: `${newY}px`,
        transform: `rotate(${(Math.random() - 0.5) * 40}deg)`
      });

      const maxAllowedWidth = window.innerWidth * 0.8;
      if (yesRect.width < maxAllowedWidth) {
        this.yesButtonScale.update(s => s + 0.15);
      }
    } else {
        setTimeout(() => this.isNoButtonRunning.set(false), 300);
    }
  }

  ngOnDestroy() {
    clearInterval(this.loadingInterval);
    if(this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.successAnimationFrameId) {
      cancelAnimationFrame(this.successAnimationFrameId);
    }
  }

  private initSuccessAnimation() {
    if (!this.successCanvas()) return;
    const canvas = this.successCanvas()!.nativeElement;
    this.successCanvasContext = canvas.getContext('2d');
    if (!this.successCanvasContext) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    this.createParticlesAt(canvas.width / 2, canvas.height / 3, 150);

    if (!this.successAnimationFrameId) {
      this.animateSuccess();
    }
  }

  private createParticlesAt(x: number, y: number, count: number) {
    const colors = ['#ff4d6d', '#ff85a1', '#ffdce0', '#ffffff'];
    for (let i = 0; i < count; i++) {
        this.particles.push({
            x,
            y,
            size: Math.random() * 4 + 2,
            speedX: (Math.random() - 0.5) * 10,
            speedY: (Math.random() - 0.5) * 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 80,
            maxLife: 80,
        });
    }
  }

  private animateSuccess() {
    if (!this.successCanvasContext) return;

    this.successCanvasContext.clearRect(0, 0, this.successCanvasContext.canvas.width, this.successCanvasContext.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.speedY += 0.15;
        p.x += p.speedX;
        p.y += p.speedY;
        p.life--;

        if (p.life <= 0) {
            this.particles.splice(i, 1);
            continue;
        }

        this.successCanvasContext.beginPath();
        this.successCanvasContext.fillStyle = p.color;
        this.successCanvasContext.globalAlpha = p.life / p.maxLife;
        this.successCanvasContext.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.successCanvasContext.fill();
        this.successCanvasContext.closePath();
    }
    this.successCanvasContext.globalAlpha = 1;

    if (this.particles.length > 0) {
        this.successAnimationFrameId = requestAnimationFrame(() => this.animateSuccess());
    } else {
        this.successAnimationFrameId = null;
    }
  }
}
