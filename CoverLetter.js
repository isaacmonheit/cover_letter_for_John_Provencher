/* ========= p5.js vine sketch ========== */
const palette = ['#173F35', '#2E8F44', '#9CD442', '#FFF6BF']; // dark → light
const PIX = 6;          // pixel size for chunky look
const NUM_VINES     = 40;      // fewer vines → fewer draw calls
const SHIFT_AMP     = 9;   // pixel wiggle amplitude for the “shifting” effect
let SCALE_FACTOR = 1;        // pixel‑block size; bigger = faster
let scaleTarget = 1;      // where we want SCALE_FACTOR to go
let scaleNow    = 1;      // smooth-eased version used in draw()
const STEP_SKIP     = 1;    // how many stored points to skip when drawing (1 = none)
const MARGIN        = 20;   // how far off‑screen vines begin / end

// ---- flower tuning ----
const FLOWER_COLORS = ['#FFB3BA',  // pastel red
                       '#BAE1FF',  // pastel blue
                       '#FFFFBA']; // pastel yellow
const FLOWER_SKIP   = 100;   // larger step → fewer flowers
const FLOWER_NEAR   = 200;   // px within which the flower spins
const FLOWER_GROW   = 3.4;   // scale multiplier when mouse is near

// ---- envelope (click‑to‑open letter) ----
const ENV_W      = 192;   // envelope width  (px on screen)
const ENV_H      = 120;   // envelope height
const FLOAT_AMP  = 6;     // vertical bob amplitude
const ENV_GROW   = 1.25;  // scale when mouse is near
const PAPER_FLOAT_AMP = 2;   // vertical bob amplitude for the paper modal
let   envelope   = {x:0,y0:0, scale:1};
let   showLetter = false;
let   letterAnim = 0;     // 0 = closed, 1 = fully open
let letterText = '';   // global for the modal’s text

let   start = true;
let envelopeImg;
let paperImg;
let letterDiv;

function preload() {
  envelopeImg = loadImage('envelope.png');
  paperImg = loadImage('paper.jpg');

  
  letterDiv = createDiv('');
  letterDiv.style('position', 'absolute');
  letterDiv.style('overflow-y', 'auto');
  letterDiv.style('white-space', 'pre-wrap');
  letterDiv.style('font-family', 'Courier New');
  letterDiv.style('font-size', '16px');
  letterDiv.style('padding', '40px');
  letterDiv.style('z-index', '50');   // above the canvas
  letterDiv.style('pointer-events', 'auto'); // allow clicks
  letterDiv.hide();
}

let pg;                        // off‑screen low‑res buffer
let vinePts = [];
let flowers = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);                 // <-- add this

  envelope.x  = width * 0.5;
  envelope.y0 = height * 0.5;   // lower‑middle
  pg = createGraphics(Math.ceil(windowWidth / SCALE_FACTOR),
                      Math.ceil(windowHeight / SCALE_FACTOR));
  pg.pixelDensity(1);
  pg.rectMode(CENTER);
  noStroke();
  if (start) {
    regenerateAll();
  }
  start = false;
}



function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Reposition envelope to center
  envelope.x  = width * 0.5;
  envelope.y0 = height * 0.5;
  // Resize off-screen buffer if initialized
  if (pg) {
    pg.resizeCanvas(Math.ceil(windowWidth / SCALE_FACTOR),
                    Math.ceil(windowHeight / SCALE_FACTOR));
    pg.rectMode(CENTER);
  }
  regenerateAll();
}

function draw() {
  // render to low‑res buffer
//   regenerateAll();
  pg.background('#444444');
  drawVine(pg);
  drawFlowers(pg);

  // floating & hover envelope
  const envY = envelope.y0 + sin(frameCount * 0.05) * FLOAT_AMP;
  const dEnv = dist(mouseX, mouseY, envelope.x, envY);
  const targetScale = dEnv < ENV_W * 0.6 ? ENV_GROW : 1;
  envelope.scale = lerp(envelope.scale, targetScale, 0.15);

  // ease SCALE_FACTOR toward its target
  scaleNow = lerp(scaleNow, scaleTarget, 0.08);
  SCALE_FACTOR = round(scaleNow);    // keep it an integer for pg buffer

    // if the integer actually changed, rebuild the buffer once
  if (pg.width !== ceil(windowWidth / SCALE_FACTOR)) {
    pg.resizeCanvas(ceil(windowWidth / SCALE_FACTOR),
                    ceil(windowHeight / SCALE_FACTOR));
    pg.rectMode(CENTER);
    // regenerateAll();
  }

  // draw the looping MOV in place of the pixel envelope
    // Envelope with drop shadow in pg buffer
    const imgW = ENV_W * envelope.scale;
    const imgH = ENV_H * envelope.scale;
    const ctxPg = pg.drawingContext;
    ctxPg.save();
    ctxPg.shadowOffsetX = 6;
    ctxPg.shadowOffsetY = 6;
    ctxPg.shadowBlur    = 12;
    ctxPg.shadowColor   = 'rgba(0,0,0,0.5)';
    pg.image(envelopeImg,
            (envelope.x - imgW / 2) / SCALE_FACTOR,
            (envY       - imgH / 2) / SCALE_FACTOR,
            imgW / SCALE_FACTOR,
            imgH / SCALE_FACTOR);
    ctxPg.restore();
  // copy to main canvas, scaled up without smoothing
  noSmooth();
  image(pg, 0, 0, width, height);

  // ----- modal animation -----
  const targetLetter = showLetter ? 1 : 0;
  letterAnim = lerp(letterAnim, targetLetter, 0.1);


   if (letterAnim > 0.02) {
     push();
     noStroke();
     imageMode(CENTER);
    // Paper now anchored 10 % from the top and stretches to the bottom
    const topMargin = height * 0.20;          // 10 % top margin
    const w  = width * 0.7 * letterAnim;      // keep 90 % width
    const h  = (height - topMargin) * letterAnim; // fill down to bottom
    const bob = Math.round(sin(frameCount * 0.05) * PAPER_FLOAT_AMP * letterAnim);

    // Paper’s vertical center is at topMargin + h/2 plus bob
    const paperY = Math.round(topMargin + h / 2 + bob);
     // Paper modal with drop shadow
     const ctxMain = drawingContext;
     ctxMain.save();
     ctxMain.shadowOffsetX = 10;
     ctxMain.shadowOffsetY = 10;
     ctxMain.shadowBlur    = 12;
     ctxMain.shadowColor   = 'rgba(0,0,0,0.5)';
     tint(255, 255 * letterAnim);
     image(paperImg, width/2, paperY, w, h);
     noTint();
     ctxMain.restore();
     imageMode(CORNER);

    if (showLetter) {
      const paperLeft = width / 2 - w / 2;
      const paperTop  = paperY - h / 2;

      const pad = 40;            // fixed 40 px margin on every side
      const innerX = paperLeft + pad;
      const innerY = paperTop  + pad;
      const innerW = w - pad * 4;   // symmetrical left & right margins
      //   const rawH = h - pad * 2;
      //   const maxInnerH = height - innerY - pad;
      const innerH = h - pad * 4;   // simply fill to bottom inside paper

      letterDiv.position(innerX, innerY);
      letterDiv.size(innerW, innerH);
      // Ensure overflow is hidden and enable vertical scroll
      letterDiv.style('overflow', 'hidden');
      letterDiv.style('overflow-y', 'auto');
      // Add custom scrollbar styling
      letterDiv.style('scrollbar-width', 'thin');
      letterDiv.style('scrollbar-color', '#888 transparent');
      letterDiv.html(letterText);
      letterDiv.show();

      // Add visual scroll hint
      if (showLetter && letterDiv.elt.scrollHeight > letterDiv.elt.clientHeight) {
        let scrollHint = document.getElementById('scrollHint');
        if (!scrollHint) {
          scrollHint = document.createElement('div');
          scrollHint.id = 'scrollHint';
          scrollHint.innerText = '↓';
          scrollHint.style.position = 'fixed';
          scrollHint.style.fontSize = '24px';
          scrollHint.style.color = 'rgba(0, 0, 0, 1)';
          scrollHint.style.left = '50%';
          scrollHint.style.bottom = '10px';
          scrollHint.style.transform = 'translateX(-50%)';
          scrollHint.style.pointerEvents = 'none';
          scrollHint.style.zIndex = '9999';
          document.body.appendChild(scrollHint);
        }
      } else {
        const existing = document.getElementById('scrollHint');
        if (existing) existing.remove();
      }

      // --- CLIP drawing context for text ---
      drawingContext.save();
      drawingContext.beginPath();
      drawingContext.rect(innerX, innerY, innerW, innerH);
      drawingContext.clip();

      drawingContext.restore();
    } else {
      letterDiv.hide();
      const existing = document.getElementById('scrollHint');
      if (existing) existing.remove();
    }

    letterText = ``;

    }
}

// Generate one vine that starts off‑screen and walks until it exits off‑screen on ANY edge
function generateVine() {
  // pick a starting edge
  const edge = floor(random(4)); // 0=L,1=R,2=T,3=B
  let x, y, heading;
  if (edge === 0) { // left
    x = -MARGIN;
    y = random(height);
    heading = random(-PI / 4, PI / 4);            // roughly rightward
  } else if (edge === 1) { // right
    x = width + MARGIN;
    y = random(height);
    heading = random((3 * PI) / 4, (5 * PI) / 4); // leftward
  } else if (edge === 2) { // top
    x = random(width);
    y = -MARGIN;
    heading = random(PI / 4, (3 * PI) / 4);       // downward
  } else { // bottom
    x = random(width);
    y = height + MARGIN;
    heading = random((-3 * PI) / 4, (-PI) / 4);   // upward
  }

  const seed = random(1000);
  let steps = 0;

  while (true) {
    // store the point
    vinePts.push({ x, y, t: steps / 5000 });

    // step
    const angle = noise(seed + steps * 0.02) * TWO_PI * 0.4 + heading;
    x += cos(angle);
    y += sin(angle);
    steps++;

    // stop if we've walked far off‑screen on ANY edge (not just the start edge)
    if (x < -MARGIN || x > width + MARGIN || y < -MARGIN || y > height + MARGIN) break;
    if (steps > 6000) break; // safety valve
  }
}

function sprinkleFlowers() {
  for (let i = 50; i < vinePts.length; i += FLOWER_SKIP) {
    const p = vinePts[i];
    flowers.push({ x: p.x,
                   y: p.y,
                   scale: 0,
                   angle: random(TWO_PI) });
  }
}

// Regenerate a fresh batch of vines + flowers
function regenerateAll() {
  vinePts.length = 0;
  flowers.length = 0;
  for (let i = 0; i < NUM_VINES; i++) {
    generateVine();
  }
  sprinkleFlowers();
}

function drawVine(g) {

  const ctx = g.drawingContext;

  // enable a crisp drop-shadow
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.shadowBlur    = 0;
  ctx.shadowColor   = 'rgba(0,0,0,1)';

  // draw every 3rd stored pixel to reduce per‑frame operations
  for (let i = 0; i < vinePts.length; i += STEP_SKIP) {
    const p  = vinePts[i];
    const dx = sin(frameCount * 0.05 + i) * SHIFT_AMP;
    const dy = cos(frameCount * 0.05 + i) * SHIFT_AMP;

    // simple gradient along vine
    const col = lerpColor(color(palette[1]), color(palette[2]), p.t);

    const px = (p.x + dx) / SCALE_FACTOR;
    const py = (p.y + dy) / SCALE_FACTOR;
    const size = PIX / SCALE_FACTOR;

    // subtle shadow for depth
    // g.fill(0, 50); // translucent black
    // g.rect(px + 2, py + 2, size, size);

    // main pixel
    // g.fill(col);
    // g.rect(px, py, size, size);

    // outline
    // main pixel with outline (one draw call)
    g.fill(col);
    g.noStroke();
    // g.stroke(0);
    // g.strokeWeight(1);
    g.rect(px, py, size, size);

  }
  ctx.shadowColor = 'rgba(0,0,0,0)';
}

// Draw a simple 5-square flower: center + 4 petals
function drawPixelFlower(g, scale, petalCol, centerCol) {
  if (scale < 0.05) return;

  const unit = PIX / SCALE_FACTOR * scale;
  const pts = [
    [ 0,  0, centerCol],   // center
    [-1,  0, petalCol],    // left
    [ 1,  0, petalCol],    // right
    [ 0, -1, petalCol],    // top
    [ 0,  1, petalCol]     // bottom
  ];
  pts.forEach(([ox, oy, col]) => {
    const x = ox * unit;
    const y = oy * unit;
    g.fill(col);
    g.rect(x, y, unit, unit);
    g.noFill();
    g.strokeWeight(1);
    g.stroke(0);
    g.rect(x, y, unit, unit);
    g.noStroke();
  });
}

// Draw a pixel-art envelope with two opposing triangles (flap + base)
function drawEnvelope(g, cx, cy, w, h, scale = 1) {
  w *= scale;
  h *= scale;
}

function drawFlowers(g) {
  flowers.forEach((f, idx) => {
    // --- update state -------------------------------------------------
    const d       = dist(mouseX, mouseY, f.x, f.y);
    const target  = d < FLOWER_NEAR ? FLOWER_GROW : 0;
    f.scale       = lerp(f.scale, target, 0.07);   // smooth approach
    f.angle      += 0.05;                          // constant spin

    // --- choose colours ----------------------------------------------
    const petalCol  = FLOWER_COLORS[idx % FLOWER_COLORS.length];
    const centerCol = lerpColor(color(petalCol), color('#000000'), 0.2);

    // --- draw ---------------------------------------------------------
    g.push();
    g.translate(f.x / SCALE_FACTOR, f.y / SCALE_FACTOR);
    g.rotate(f.angle);
    drawPixelFlower(g, f.scale, petalCol, centerCol);
    g.pop();
  });
}

function mousePressed() {
  const envY  = envelope.y0 + sin(frameCount * 0.05) * FLOAT_AMP;
  const halfW = (ENV_W * envelope.scale) / 2;
  const halfH = (ENV_H * envelope.scale) / 2;

  const hit = mouseX > envelope.x - halfW && mouseX < envelope.x + halfW &&
              mouseY > envY     - halfH && mouseY < envY     + halfH;

  if (!showLetter && hit) {
    showLetter  = true;
    // textScroll = 0;      // reset scroll to top when opening
    scaleTarget = 6;          // zoom to chunky pixels
  } else if (showLetter) {
    // Only close if click is outside the letter box
    const w = width * 0.7;
    const h = height * 1;
    const left   = width/2 - w/2;
    const right  = width/2 + w/2;
    const top    = height/2 - h/2 + height * 0.20;
    const bottom = height/2 + h/2;

    if (mouseX < left || mouseX > right || mouseY < top || mouseY > bottom) {
      showLetter  = false;
      scaleTarget = 1;
    }
  }
}


function keyPressed() {
  if (keyCode === ESCAPE && showLetter) {
    showLetter = false;
    scaleTarget = 1;
  }
}