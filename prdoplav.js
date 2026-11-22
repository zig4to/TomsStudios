/* Prdoplav — gostitelj (prdoplav.html): fizika splava, izris, tipkovnica in soba za telefone.
   Svet: x desno, y naprej po reki (navzgor po zaslonu). Splav je krog, živali stojijo na robu
   (kot phi glede na splav). „Levo“ = žival se pomakne v svojo levo, ko gleda proti sredini
   (v smeri urinega kazalca). Prdec odrine splav od živali proti sredini. */
(function () {
  "use strict";

  var NET = window.PRDONET;
  var ANIMALS = NET.ANIMALS;
  var TEAMS = NET.TEAMS;   // barve in imena splavov pri tekmi
  var $ = function (id) { return document.getElementById(id); };
  var cv = $("cv");
  var ctx = cv.getContext("2d");
  var W = 0, H = 0, DPR = 1, S = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    S = Math.min(W, H * 1.35) / 820;
    if (typeof R3 !== "undefined" && R3) R3.resize(W, H);
  }
  window.addEventListener("resize", resize);
  resize();

  /* =================== Proge ===================
     river: [y, sredina x, polovična širina]; ovire imajo x glede na sredino reke. */
  /* wide = koliko je reka širša od zapisane (začetne proge so najširše). */
  var LEVELS = [
    {
      name: "Prvi pljusk", len: 2600, wide: 1.3,
      river: [[0, 0, 320], [800, 60, 320], [1600, -60, 300], [2800, 0, 320]],
      rocks: [[0, 500, 28], [-140, 900, 35], [120, 1350, 30], [150, 1700, 35], [-120, 2100, 30], [60, 2400, 25]],
      logs: [],
      pools: [],
      flows: [[1200, 250, 0, 80]]
    },
    {
      name: "Lenobni potok", len: 4300, wide: 1.3,
      river: [[0, 0, 320], [600, 0, 300], [1200, 140, 260], [1800, 180, 240], [2400, -60, 250], [3000, -160, 240], [3600, 0, 270], [4600, 0, 300]],
      rocks: [[100, 600, 30], [-150, 900, 40], [160, 1200, 30], [-20, 1500, 45], [100, 1900, 35], [-40, 2300, 50], [-130, 2700, 40], [0, 3200, 45], [140, 3450, 35], [-160, 3800, 30], [80, 4050, 28]],
      logs: [],
      pools: [],
      flows: [[2000, 260, 0, 70]]
    },
    {
      name: "Račji ribnik", len: 3800, wide: 1.25,
      river: [[0, 0, 300], [700, 0, 280], [1200, 0, 420], [2000, 80, 440], [2600, 0, 280], [3200, -100, 260], [4000, 0, 300]],
      rocks: [[-120, 900, 30], [-200, 1500, 40], [180, 1900, 40], [200, 2150, 35], [0, 2300, 30], [-180, 2650, 30], [60, 3200, 35], [-60, 3550, 30]],
      logs: [],
      pools: [[120, 1700, 110, 0.7], [-150, 2000, 90, 0.6]],
      flows: [[2700, 250, -70, 30]]
    },
    {
      name: "Hribovita reka", len: 4200, wide: 1.25,
      river: [[0, 0, 300], [1000, 80, 280], [2000, -80, 280], [3000, 60, 280], [4400, 0, 300]],
      rocks: [[120, 600, 30], [-60, 1000, 30], [-150, 1300, 35], [60, 1900, 30], [-120, 2300, 30], [140, 2700, 35], [0, 3450, 30], [100, 3900, 30]],
      logs: [], pools: [], flows: [],
      spinners: [[-20, 3100, 90, 0.6, "I", 0]],
      hills: [[0, 0], [500, 0], [800, 90], [1100, 90], [1350, 0], [1700, -60], [2100, -60], [2400, 50], [2700, 50], [3000, 130], [3300, 130], [3650, 30], [4400, 30]]
    },
    {
      name: "Skalni kanjon", len: 5200, wide: 1.15,
      river: [[0, 0, 300], [500, 0, 220], [1100, -150, 190], [1700, 100, 180], [2300, 250, 200], [2900, 0, 175], [3500, -200, 190], [4100, 0, 165], [4700, 150, 200], [5500, 0, 280]],
      rocks: [[90, 700, 40], [-100, 1150, 40], [100, 1500, 40], [-90, 2050, 40], [60, 2400, 35], [-130, 2520, 30], [-100, 3000, 35], [90, 3450, 40], [-80, 4000, 35], [-60, 4400, 30], [90, 4650, 40], [-70, 5000, 30]],
      logs: [[1300, 70, 1.1, 0], [2700, 70, 1.4, 1.5], [3750, 65, 1.6, 0.7]],
      pools: [],
      flows: [[1800, 260, -110, 20], [3250, 260, 110, 20], [4250, 300, 0, 110]]
    },
    {
      name: "Zapornice", len: 4400, wide: 1.2,
      river: [[0, 0, 300], [800, 0, 260], [1600, 100, 250], [2400, -80, 260], [3200, 60, 250], [4000, 0, 260], [4700, 0, 300]],
      rocks: [[100, 550, 30], [-130, 1350, 35], [60, 1550, 30], [-60, 2050, 30], [120, 2250, 35], [90, 2950, 30], [-100, 3150, 35], [-80, 3400, 30], [60, 4200, 30]],
      logs: [[1150, 60, 0.9, 0], [3250, 60, 1.0, 1.2]], pools: [],
      flows: [[4000, 250, 0, 80]],
      gates: [[900, 6, 0], [1800, 5.5, 1.5], [2700, 5, 3], [3600, 4.5, 0.8]]
    },
    {
      name: "Hlodovina", len: 4600, wide: 1.15,
      river: [[0, 0, 300], [800, 0, 260], [1600, 120, 250], [2400, -100, 260], [3200, 80, 240], [4000, 0, 260], [4900, 0, 300]],
      rocks: [[100, 550, 30], [-120, 1100, 35], [100, 1350, 30], [-100, 1950, 30], [110, 2100, 35], [0, 3000, 28], [-90, 3500, 35], [100, 3750, 30], [-80, 4400, 30]],
      logs: [[900, 70, 0.9, 0], [1700, 70, 1.0, 1], [2600, 80, 1.1, 2], [3300, 70, 1.2, 0.5], [4100, 70, 1.3, 1.7]],
      pools: [],
      flows: [[2900, 250, 0, 90]]
    },
    {
      name: "Vrtinčni slapovi", len: 6000, wide: 1.15,
      river: [[0, 0, 300], [600, 0, 240], [1200, 180, 200], [1800, -100, 175], [2400, -250, 220], [3000, 0, 165], [3600, 200, 200], [4200, 0, 160], [4800, -150, 190], [5400, 0, 175], [6300, 0, 300]],
      rocks: [[-100, 550, 30], [-110, 900, 35], [100, 2000, 35], [-90, 3300, 35], [90, 4500, 40], [100, 5550, 30], [0, 5750, 35]],
      logs: [[1700, 70, 1.3, 0], [3000, 60, 1.6, 2], [4300, 60, 1.8, 1], [5300, 70, 1.5, 0.4]],
      pools: [[60, 1400, 120, 1], [-60, 2650, 130, 1.1], [50, 3900, 110, 1.2], [-50, 5050, 120, 1.25]],
      flows: [[2150, 240, 120, 10], [3450, 240, -130, 10], [4650, 220, 130, 10]]
    },
    {
      name: "Bodičasti ovinki", len: 4800, wide: 1.15,
      river: [[0, 0, 300], [400, 0, 220], [900, -200, 190], [1400, 150, 185], [1900, -180, 190], [2400, 160, 185], [2900, -150, 190], [3400, 170, 185], [3900, -120, 190], [4400, 0, 200], [5100, 0, 280]],
      rocks: [[60, 1150, 25], [-60, 2150, 25], [60, 3150, 25], [-60, 4150, 25]], logs: [], pools: [],
      flows: [[2600, 250, 0, 60]],
      spikes: [[500, 4450]]
    },
    {
      // brez bregov: kanal visoko nad sotesko — kdor zapelje čez rob, pade dol
      name: "Brez ograje", len: 4400, wide: 1.0, noFence: true,
      river: [[0, 0, 280], [600, 0, 240], [1200, 120, 230], [1800, -100, 220], [2400, 80, 230], [3000, -60, 220], [3600, 60, 230], [4600, 0, 280]],
      rocks: [[-90, 800, 28], [0, 1500, 30], [90, 2250, 28], [0, 3000, 30], [-80, 3750, 28]],
      logs: [], pools: [],
      flows: [[2100, 240, -80, 10]]
    },
    {
      // dolg vzpon s počivališči; na klancih se vrtijo leseni vrtiljaki,
      // vmes odseki brez ograje levo (L), desno (R) ali na obeh straneh (B)
      name: "Dolgi klanec", len: 5600, wide: 1.2,
      river: [[0, 0, 300], [800, 0, 260], [1600, 100, 250], [2400, -80, 240], [3200, 60, 250], [4000, -60, 240], [4800, 40, 250], [5900, 0, 300]],
      rocks: [[-100, 700, 30], [100, 1100, 30], [90, 2600, 30], [-80, 3750, 30], [60, 5150, 30]],
      logs: [[1450, 70, 0.9, 0], [5400, 70, 1.0, 1]], pools: [], flows: [],
      hills: [[0, 0], [500, 0], [1300, 60], [1600, 60], [2400, 130], [2700, 130], [3600, 210], [3900, 210], [4900, 290], [5900, 290]],
      open: [[1650, 2350, "L"], [2750, 3550, "R"], [3950, 4800, "B"]],
      // vrtiljaki: [x glede na sredino, y, dolžina kraka, hitrost (rad/s, predznak = smer), oblika, zamik]
      // oblika: "+" križ, "T" brez enega kraka, "I" deska, "L" kot, ali število enakomernih krakov
      spinners: [[-60, 2000, 140, 0.65, "T", 0], [80, 3150, 100, -1.1, "+", 0.4], [-90, 4250, 150, 0.55, "I", 0], [110, 4600, 85, -1.3, "L", 1]]
    },
    {
      // zelo strmi klanci: tok sam ne nese gor, splav brez prdcev zdrsne nazaj.
      // Na ravnih vmes se spočiješ (tok spet nese naprej).
      name: "Težki prdec", len: 3800, wide: 1.2,
      river: [[0, 0, 300], [700, 0, 260], [1500, -60, 250], [2300, 60, 250], [3100, -40, 250], [3900, 0, 300]],
      rocks: [[-90, 800, 30], [110, 1000, 28], [100, 1800, 30], [-110, 2000, 28], [-60, 2700, 30], [100, 2850, 28]],
      logs: [], pools: [], flows: [],
      hills: [[0, 0], [500, 0], [1150, 200], [1450, 200], [2100, 420], [2400, 420], [3000, 670], [3900, 670]],
      // vrtiljaki na ravninah med klanci (tam, kjer se spočiješ)
      spinners: [[70, 1300, 120, 0.7, "T", 0], [70, 2250, 90, -1.1, "+", 0.5], [-60, 3400, 140, 0.6, "I", 0.2]]
    },
    {
      name: "Velika finala", len: 6600, wide: 1.15,
      river: [[0, 0, 300], [700, 0, 250], [1400, -150, 220], [2100, 120, 220], [2800, 0, 240], [3500, -180, 220], [4200, 100, 220], [4900, 0, 230], [5600, -120, 220], [6900, 0, 300]],
      rocks: [[-90, 500, 30], [90, 800, 35], [-100, 1500, 35], [110, 2400, 35], [90, 3150, 30], [-90, 3300, 35], [100, 4500, 35], [-60, 5400, 35], [80, 6400, 30]],
      logs: [[1900, 70, 1.1, 0], [3800, 70, 1.3, 1], [6000, 70, 1.4, 2]],
      pools: [[-40, 2900, 110, 0.9], [50, 5000, 110, 1]],
      spinners: [[100, 4150, 110, 0.9, "T", 0], [-100, 5750, 80, -1.3, "L", 0.5]],
      flows: [[1100, 240, 90, 20], [4700, 240, -100, 20], [6200, 280, 0, 100]]
    },
    {
      name: "Gorski spust", len: 6200, wide: 1.15,
      river: [[0, 0, 300], [700, 0, 240], [1400, -150, 220], [2100, 120, 220], [2800, 0, 230], [3500, -160, 210], [4200, 120, 210], [4900, 0, 220], [5600, -100, 220], [6500, 0, 300]],
      rocks: [[-90, 600, 30], [100, 1000, 35], [60, 1400, 30], [-90, 2600, 35], [0, 4050, 28], [90, 4700, 35], [-80, 5500, 30], [80, 6100, 30]],
      logs: [[5300, 70, 1.0, 0]],
      pools: [[-40, 2200, 100, 0.8]],
      flows: [],
      hills: [[0, 0], [600, 0], [900, -80], [1200, -80], [1600, 40], [2000, 40], [2400, -60], [3000, -60], [3300, 60], [3700, 60], [4300, -100], [5000, -100], [5300, 20], [6500, 20]],
      gates: [[1800, 5.5, 0], [3800, 5, 2], [5800, 5, 1]],
      spikes: [[2900, 3600], [4400, 5000]]
    },
    {
      // ovinkasta reka brez ograje: ob robu čakajo povodni možje (kdor se jim približa,
      // potone), krokodili plavajo čez reko, na slapu je varen le žleb med zelenima kolema,
      // rešilni obroči vrnejo življenje
      name: "Povodni mož", len: 5600, wide: 1.2, noFence: true, tier: 2,
      river: [[0, 0, 300], [600, 0, 260], [1100, -170, 245], [1600, 160, 245], [2100, -150, 250], [2500, 0, 280], [2950, 0, 280],
        [3400, 170, 245], [3900, -170, 245], [4300, 40, 270], [4750, 40, 270], [5150, -120, 250], [5900, 0, 300]],
      rocks: [[70, 700, 28], [-60, 3200, 30], [0, 5450, 28]],
      logs: [], pools: [],
      flows: [[1180, 240, 60, 0], [3550, 220, -60, 0]],
      // povodni možje: [stran (-1 levo / 1 desno), y]
      mozje: [[-1, 900], [1, 1350], [-1, 1900], [1, 2300], [-1, 3250], [-1, 3700], [1, 4150], [-1, 4900], [1, 5250]],
      // krokodili: [x glede na sredino, y, razpon (del polširine reke), hitrost (rad/s), zamik]
      crocs: [[0, 1550, 0.55, 0.75, 0], [0, 2150, 0.5, 0.95, 1.5], [0, 3050, 0.55, 0.7, 3], [0, 3550, 0.5, 0.9, 0.6],
        [0, 4250, 0.5, 0.8, 2.2], [0, 5000, 0.55, 1.0, 4]],
      // slapovi: [y, višina padca, sredina žleba glede na sredino reke, polovica širine žleba]
      falls: [[2750, 170, -70, 80], [4550, 120, 80, 80]],
      // rešilni obroči: [x glede na sredino, y]
      buoys: [[-90, 1700], [110, 3150], [-70, 4400]]
    },
    {
      // velika navpična mlinska kolesa čez reko: lopate se vrtijo skozi vodo, med njimi
      // je treba zapeljati ob pravem času; vmes odseki brez ograje s povodnimi možmi
      name: "Mlinska kolesa", len: 5400, wide: 1.15, tier: 2,
      river: [[0, 0, 300], [700, 0, 270], [1300, -120, 260], [1900, 120, 260], [2500, -60, 280], [3100, 80, 270],
        [3700, -100, 260], [4300, 90, 260], [4900, -40, 270], [5700, 0, 300]],
      open: [[900, 1800, "B"], [3300, 4000, "L"], [4000, 4700, "R"]],
      rocks: [[-90, 700, 28], [100, 2950, 30], [-80, 5200, 28]],
      logs: [], flows: [],
      pools: [[60, 3950, 90, 0.7]],
      // mlinska kolesa: [x glede na sredino, y, dolžina lopate, višina osi nad vodo, hitrost (rad/s), število lopat]
      // eno veliko kolo na sredini reke
      wheels: [[0, 1100, 300, 200, 0.55, 4], [0, 2200, 310, 205, -0.5, 3], [0, 3500, 300, 200, 0.6, 4], [0, 4800, 310, 205, -0.65, 4]],
      crocs: [[0, 1600, 0.5, 0.8, 0], [0, 2800, 0.55, 0.9, 1], [0, 4100, 0.5, 0.85, 2]],
      mozje: [[1, 1450], [-1, 3650], [1, 4400]],
      falls: [[2550, 140, 60, 80]],
      buoys: [[80, 1900], [-90, 3300]]
    },
    {
      // brez ograje in zelo ozko; dvakrat se razcepi v tri ozke rokave (med otočki) in
      // spet združi. Mlinska kolesa čez vse rokave, slap, za njim trampolin čez steno nazaj gor.
      name: "Trije rokavi", len: 6400, wide: 1.0, noFence: true, tier: 2,
      river: [[0, 0, 300], [500, 0, 220], [850, 0, 110], [1250, 90, 100], [1650, -80, 100], [2000, 0, 130], [2250, 0, 320], [3050, 0, 320],
        [3300, 0, 120], [3650, 0, 110], [3850, 0, 200], [4700, 0, 200], [4900, 0, 320], [5700, 0, 320], [5950, 60, 110], [6250, 0, 130], [6700, 0, 300]],
      rocks: [[-80, 400, 26]],
      logs: [], pools: [], flows: [],
      // otočki (rokavi med njimi): [x glede na sredino, od y, do y, polmer]
      islands: [[-142, 2350, 2950, 28], [142, 2350, 2950, 28], [-142, 5000, 5600, 28], [142, 5000, 5600, 28]],
      wheels: [[0, 1150, 150, 100, 0.7, 3], [0, 2650, 260, 120, 0.5, 4], [0, 5300, 260, 120, -0.6, 4]],
      crocs: [[0, 4300, 0.5, 0.8, 0]],
      falls: [[3950, 160, 0, 70]],
      // trampolin pred steno: [y stene, višina stene, x trampolina glede na sredino, polovica širine]
      jumps: [[4620, 150, 0, 85]],
      buoys: [[-232, 2800], [0, 4400], [232, 5450]]
    },
    {
      // zelo ozka struga, ki vijuga kot kača; bregovi so gumijasti (odbijejo, ne bolijo),
      // le na dveh odsekih z bodicami dotik stane življenje
      name: "Kačja struga", len: 5600, wide: 1.0, tier: 2, soft: true,
      river: [[0, 0, 280], [400, 0, 200], [700, 0, 130], [1000, 90, 130], [1300, -90, 130], [1600, 90, 130], [1900, -90, 130],
        [2200, 0, 140], [2450, 0, 175], [2650, 0, 175], [2950, 100, 130], [3270, -100, 130], [3590, 100, 130], [3910, -100, 130],
        [4230, 100, 130], [4550, -60, 135], [4850, 60, 140], [5100, 0, 180], [5350, 0, 240], [5900, 0, 300]],
      rocks: [[-95, 2550, 20]],
      logs: [], pools: [], flows: [],
      spikes: [[2400, 2700], [5000, 5200]],
      buoys: [[0, 2200], [0, 4550]]
    },
    {
      // topovi na bregovih streljajo krogle čez reko; tik pred strelom top zažari
      name: "Topovska soteska", len: 5400, wide: 1.15, tier: 2,
      river: [[0, 0, 300], [700, 0, 260], [1300, -100, 250], [1900, 100, 250], [2500, -80, 260], [3100, 80, 250],
        [3700, -90, 250], [4300, 90, 250], [4900, 0, 260], [5700, 0, 300]],
      rocks: [[-100, 1450, 28], [110, 2150, 30], [0, 3550, 30], [-90, 4500, 28]],
      logs: [], pools: [], flows: [],
      // topovi: [breg (-1 levo / 1 desno), y, perioda (s), zamik, hitrost krogle]
      cannons: [[-1, 900, 3.0, 0, 400], [1, 1250, 3.2, 1.0, 420], [-1, 1700, 2.8, 0.5, 440], [1, 1760, 2.8, 1.9, 440],
        [-1, 2400, 3.0, 0.2, 460], [1, 2700, 2.6, 1.3, 460], [-1, 3200, 2.6, 0.6, 480], [1, 3260, 2.6, 1.9, 480],
        [-1, 3900, 2.4, 0, 500], [1, 4250, 2.4, 1.2, 500], [-1, 4700, 2.2, 0.4, 520], [1, 4760, 2.2, 1.5, 520]],
      buoys: [[0, 2050], [-80, 4050]]
    },
    {
      // polje gejzirjev: mehurčki napovedo izbruh, izbruh vrže splav visoko naprej —
      // pristanek na skali boli
      name: "Vroči vrelci", len: 5200, wide: 1.2, tier: 2,
      river: [[0, 0, 300], [600, 0, 280], [1200, -120, 300], [1800, 120, 300], [2400, 0, 320], [3000, -110, 300],
        [3600, 110, 300], [4200, 0, 320], [4800, 0, 300], [5600, 0, 300]],
      rocks: [[140, 1500, 28], [-100, 2500, 30], [60, 3600, 30], [-60, 4500, 28]],
      logs: [], pools: [], flows: [],
      // gejzirji: [x glede na sredino, y, perioda (s), zamik]
      geysers: [[-120, 800, 3.2, 0], [120, 950, 3.2, 1.6], [0, 1300, 2.8, 0.7], [-160, 1650, 3, 0], [80, 1750, 3, 1.5],
        [-40, 2150, 2.6, 0.4], [170, 2300, 2.6, 1.7], [-170, 2750, 3, 0.9], [0, 2950, 2.8, 2.0], [150, 3300, 2.4, 0.3],
        [-110, 3450, 2.4, 1.4], [40, 3850, 2.6, 0.8], [-150, 4150, 2.6, 2.1], [150, 4250, 2.6, 0.6]],
      buoys: [[200, 1950], [-200, 3700]]
    },
    {
      // portali: modri te prestavijo naprej (bližnjica), oranžni nazaj (past)
      name: "Portali", len: 6200, wide: 1.1, tier: 2,
      river: [[0, 0, 300], [700, 0, 250], [1300, -140, 240], [1900, 140, 240], [2500, -140, 240], [3100, 0, 260],
        [3700, 140, 240], [4300, -140, 240], [4900, 0, 250], [5500, 0, 260], [6300, 0, 300]],
      rocks: [[100, 2550, 28], [-90, 3900, 28], [80, 5300, 28]],
      logs: [[2150, 70, 1.1, 0], [4500, 70, 1.3, 1.2]],
      pools: [[0, 3550, 90, 0.7]], flows: [],
      // portali: [x vhoda, y vhoda, x izhoda, y izhoda] (x glede na sredino reke)
      portals: [[-150, 1000, 120, 1750], [150, 3250, -100, 4100], [0, 5000, 0, 5700],
        [120, 1450, -100, 700], [-120, 2300, -60, 1600], [0, 2850, 0, 2000], [-130, 4650, 100, 3700]],
      buoys: [[0, 1250], [0, 4850]]
    },
    {
      // zamrznjena reka: splav drsi (voda ga skoraj ne vodi), ledene gore in plavajoče ledene plošče
      name: "Ledena reka", len: 5200, wide: 1.15, tier: 2, ice: 0.3,
      river: [[0, 0, 300], [700, 0, 270], [1300, -130, 260], [1900, 130, 260], [2500, -130, 270], [3100, 100, 260],
        [3700, -100, 260], [4300, 80, 270], [4900, 0, 280], [5600, 0, 300]],
      rocks: [[-80, 900, 30], [100, 1500, 32], [-110, 2100, 30], [60, 2700, 34], [-60, 3300, 30], [110, 3800, 30], [-90, 4400, 32]],
      logs: [[1200, 70, 0.9, 0], [3000, 70, 1.0, 1.4]], pools: [], flows: [],
      buoys: [[0, 2400], [0, 4100]]
    },
    {
      // plavajoče mine: dotik = eksplozija (življenje + sunek), mina se čez nekaj sekund vrne
      name: "Minsko polje", len: 5400, wide: 1.2, tier: 2,
      river: [[0, 0, 300], [700, 0, 280], [1300, -110, 290], [1900, 110, 290], [2500, 0, 300], [3100, -110, 290],
        [3700, 110, 290], [4300, 0, 300], [4900, 0, 290], [5600, 0, 300]],
      rocks: [], logs: [], pools: [], flows: [],
      // mine: [x glede na sredino, y]
      mines: [[-220, 800], [0, 800], [220, 800], [-110, 1150], [110, 1150], [-250, 1500], [0, 1500], [250, 1500],
        [-130, 1850], [130, 1850], [-220, 2200], [0, 2200], [220, 2200], [-110, 2550], [110, 2550],
        [-250, 2900], [-30, 2900], [200, 2900], [-120, 3250], [120, 3250], [-220, 3600], [0, 3600], [220, 3600],
        [-110, 3950], [110, 3950], [-230, 4300], [0, 4300], [230, 4300], [-110, 4650], [110, 4650]],
      buoys: [[0, 1320], [0, 3420]]
    },
    {
      // vse skupaj: topovi, mine, mlinsko kolo, gejzirji, portali, krokodili in slap
      name: "Velika zmešnjava", len: 7200, wide: 1.2, tier: 2,
      river: [[0, 0, 300], [700, 0, 280], [1300, -120, 280], [1900, 120, 280], [2500, 0, 300], [3100, -120, 280], [3700, 120, 280],
        [4300, 0, 300], [4900, -120, 280], [5500, 120, 280], [6100, 0, 300], [6700, 0, 300], [7600, 0, 300]],
      rocks: [[100, 6500, 30]], logs: [], pools: [], flows: [],
      cannons: [[-1, 900, 3.0, 0, 420], [1, 1150, 3.0, 1.5, 420]],
      mines: [[-150, 1700], [150, 1700], [0, 2000], [-200, 2300], [200, 2300]],
      wheels: [[0, 2700, 300, 200, 0.55, 4]],
      geysers: [[-120, 3100, 3, 0], [120, 3300, 3, 1.5], [0, 3550, 2.8, 0.7], [-150, 3800, 2.6, 2]],
      portals: [[150, 4200, -120, 4900], [-150, 4500, 100, 3950]],
      crocs: [[0, 5200, 0.55, 0.8, 0], [0, 5600, 0.5, 0.9, 1.5]],
      falls: [[6100, 140, 0, 90]],
      buoys: [[0, 2500], [0, 4050], [0, 5900]]
    },
    {
      // ozka vijugava struga z gumijastimi bregovi in dvema slapovoma; žleb je ob strani,
      // tik pred slapom pa strelja top
      name: "Kačji slapovi", len: 5800, wide: 1.0, tier: 2, soft: true,
      river: [[0, 0, 280], [400, 0, 200], [700, 0, 135], [1000, 80, 135], [1300, -80, 135], [1600, 80, 135], [1900, 0, 150], [2200, 0, 150],
        [2500, 90, 135], [2800, -90, 135], [3100, 90, 135], [3400, 0, 150], [3700, 0, 150],
        [4000, -90, 135], [4300, 90, 135], [4600, -90, 135], [4900, 0, 160], [5200, 0, 220], [5600, 0, 260], [6100, 0, 300]],
      rocks: [], logs: [], pools: [], flows: [],
      falls: [[2050, 130, -45, 55], [3550, 150, 45, 55]],
      cannons: [[-1, 1950, 2.8, 0, 380], [1, 3450, 2.8, 1, 380]],
      buoys: [[0, 2300], [0, 3800]]
    }
  ];

  /* Hribčki: višina vode (h) vzdolž reke. Navzdol splav pospeši, navzgor ga vleče nazaj. */
  function elev(lv, y) {
    var p = lv.hills;
    if (!p || !p.length) return 0;
    if (y <= p[0][0]) return p[0][1];
    for (var i = 1; i < p.length; i++) {
      if (y <= p[i][0]) {
        var a = p[i - 1], b = p[i];
        var t = (y - a[0]) / (b[0] - a[0]);
        t = t * t * (3 - 2 * t);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return p[p.length - 1][1];
  }
  function slopeAt(lv, y) { return (elev(lv, y + 10) - elev(lv, y - 10)) / 20; }
  function spiky(lv, y) {
    return !!lv.spikes && lv.spikes.some(function (s) { return y >= s[0] && y <= s[1]; });
  }
  // Ali je ta stran ("L" / "R") na višini y brez ograje (čez rob se pade)?
  function openSide(lv, y, side) {
    if (lv.noFence) return true;
    return !!lv.open && lv.open.some(function (o) { return y >= o[0] && y <= o[1] && (o[2] === "B" || o[2] === side); });
  }
  // Vrtiljak: lesen križ, ki se vrti okoli stebra. Vrne kot prvega kraka.
  var SPIN_HUB = 16, SPIN_ARM = 9;
  function spinAng(s) { return s.ph + G.time * s.w; }
  // Krokodil plava levo-desno; telo je kapsula vzdolž smeri plavanja.
  var CROC_HALF = 34, CROC_R = 13;
  function crocX(c) { return c.bx + c.amp * Math.sin(G.time * c.w + c.ph); }
  function crocV(c) { return c.amp * c.w * Math.cos(G.time * c.w + c.ph); }
  // Povodni mož zgrabi splav, ko je rob splava bližje kot PM_GRAB; pod vodo ga vleče PM_SINK s.
  var PM_GRAB = 40, PM_WARN = 190, PM_SINK = 1.4;
  var BUOY_R = 16;
  // Mlinsko kolo: navpično, os vzdolž reke; lopate se vrtijo čez reko. Pod vodo je le del
  // lopate (kjer je pod gladino) — to je ovira (vodoravna črta čez reko na y kolesa).
  var WHEEL_T = 12, WHEEL_SPEED = 0.8; // vsa mlinska kolesa malo počasneje
  function wheelAng(wh) { return wh.ph + G.time * wh.w * WHEEL_SPEED; }
  function wheelSegs(wh) {
    var out = [], a0 = wheelAng(wh);
    for (var k = 0; k < wh.nb; k++) {
      var a = a0 + k * 2 * Math.PI / wh.nb, c = Math.cos(a), sn = Math.sin(a);
      if (c * wh.R <= wh.h + 2) continue;       // lopata nad vodo
      var s0 = wh.h / c;                         // razdalja po lopati do gladine
      var xa = wh.x + s0 * sn, xb = wh.x + wh.R * sn;
      out.push({ x1: Math.min(xa, xb), x2: Math.max(xa, xb), vx: wh.w * WHEEL_SPEED * ((s0 + wh.R) / 2) * c });
    }
    return out;
  }
  // Topovi: krogla prečka reko vsakih "period" s; tik pred strelom top zažari (warn 0..1).
  var BALL_R = 16;
  function cannonBall(c) {
    var tau = ((G.time + c.ph) % c.period + c.period) % c.period;
    return { on: tau < c.dist / c.speed, x: c.x0 - c.side * c.speed * tau, warn: Math.max(0, (tau - (c.period - 0.8)) / 0.8) };
  }
  // Gejzirji: mehurčki (warn 0..1), nato izbruh (up 0..1) za GEY_UP s.
  var GEY_R = 55, GEY_UP = 0.7;
  function geyserState(g) {
    var tau = ((G.time + g.ph) % g.period + g.period) % g.period;
    return { up: tau < GEY_UP ? 1 - tau / GEY_UP : 0, warn: Math.max(0, (tau - (g.period - 1.3)) / 1.3) };
  }
  // Mine: dotik razstreli mino (življenje + sunek); čez MINE_BACK s se vrne.
  var MINE_R = 18, MINE_BACK = 4;
  function mineOn(m) { return G.time - m.boomAt > MINE_BACK || G.time < m.boomAt; }
  // Portali: vhod prestavi splav na izhod (modri naprej, oranžni nazaj).
  var PORT_R = 46;
  // Skok s trampolina: splav leti čez steno na višji del reke.
  var JUMP_TIME = 1.1, JUMP_PEAK = 110;
  function airLift(r) { if (!r.air) return 0; var k = Math.min(1, r.air.t); return r.air.peak * 4 * k * (1 - k); }
  // Oblika vrtiljaka → koti krakov (radiani).
  function spinShape(sh) {
    var q = Math.PI / 2;
    if (sh === "T") return [0, q, 2 * q];
    if (sh === "I") return [0, 2 * q];
    if (sh === "L") return [0, q];
    if (sh === "Y") return [0, 2 * Math.PI / 3, 4 * Math.PI / 3];
    var n = typeof sh === "number" ? sh : 4, out = [];
    for (var i = 0; i < n; i++) out.push(i * 2 * Math.PI / n);
    return out;
  }

  function river(lv, y) {
    var p = lv.river;
    if (y <= p[0][0]) return { cx: p[0][1], hw: p[0][2] };
    for (var i = 1; i < p.length; i++) {
      if (y <= p[i][0]) {
        var a = p[i - 1], b = p[i];
        var t = (y - a[0]) / (b[0] - a[0]);
        t = t * t * (3 - 2 * t);
        return { cx: a[1] + (b[1] - a[1]) * t, hw: a[2] + (b[2] - a[2]) * t };
      }
    }
    var l = p[p.length - 1];
    return { cx: l[1], hw: l[2] };
  }

  // Ovire v svetovne koordinate (enkrat na progo).
  // Lažje: širše reke, šibkejši vrtinci in tokovi, krajši in počasnejši hlodi.
  var LOG_LEN = 0.6, LOG_SPEED = 0.5, LOG_R = 10;
  // Prdci na igralca po progah (težje / daljše proge → več). V meniju in sobi se prišteje G.fartDelta.
  var FART_DEFAULT = {
    "Prvi pljusk": 30, "Lenobni potok": 40, "Račji ribnik": 40, "Hribovita reka": 55,
    "Skalni kanjon": 55, "Zapornice": 50, "Hlodovina": 50, "Vrtinčni slapovi": 65,
    "Bodičasti ovinki": 60, "Brez ograje": 55, "Dolgi klanec": 85, "Težki prdec": 120, "Velika finala": 75, "Gorski spust": 85, "Povodni mož": 70, "Mlinska kolesa": 70, "Trije rokavi": 75,
    "Kačja struga": 80, "Topovska soteska": 70, "Vroči vrelci": 60, "Portali": 65,
    "Ledena reka": 70, "Minsko polje": 60, "Velika zmešnjava": 90, "Kačji slapovi": 85
  };
  var EASY = 0.8;
  LEVELS.forEach(function (lv) {
    lv.river = lv.river.map(function (p) { return [p[0], p[1], p[2] * (lv.wide || 1.1)]; });
    lv.pools = lv.pools.map(function (p) { return [p[0], p[1], p[2], p[3] * EASY]; });
    lv.flows = lv.flows.map(function (f) { return [f[0], f[1], f[2] * EASY, f[3]]; });
    if (lv.hills) lv.hills = lv.hills.map(function (h) { return [h[0], h[1] * 2]; }); // bolj vidni hribčki
  });

  /* Proga v svetovnih koordinatah za dano širino wk (tekma več splavov: reka je širša,
     ovire se razmaknejo od sredine za isti faktor — postavitev ostane enaka). */
  function prepareLevel(lv, wk) {
    if (!lv.baseRiver) lv.baseRiver = lv.river;
    lv.wk = wk;
    lv.river = lv.baseRiver.map(function (p) { return [p[0], p[1], p[2] * wk]; });
    lv.R = lv.rocks.map(function (r) { return { x: river(lv, r[1]).cx + r[0] * wk, y: r[1], r: r[2] }; });
    lv.L = lv.logs.map(function (l) {
      var rv = river(lv, l[0]);
      // lažje: hlodi so krajši (60 %) in počasnejši (50 %)
      var half = l[1] * LOG_LEN * wk;
      return { y: l[0], bx: rv.cx, half: half, amp: Math.max(20, rv.hw - half - 10), speed: l[2] * LOG_SPEED, ph: l[3] };
    });
    lv.P = lv.pools.map(function (p) { return { x: river(lv, p[1]).cx + p[0] * wk, y: p[1], r: p[2], str: p[3] }; });
    lv.F = lv.flows.map(function (f) { return { y: f[0], h: f[1], fx: f[2], fy: f[3] }; });
    lv.Sp = (lv.spinners || []).map(function (s) {
      return { x: river(lv, s[1]).cx + s[0] * wk, y: s[1], len: s[2], w: s[3], angs: spinShape(s[4]), ph: s[5] || 0 };
    });
    // povodni možje ob robu (sledijo širini reke), krokodili, slapovi z žlebom, rešilni obroči
    lv.Pm = (lv.mozje || []).map(function (m) {
      var rv = river(lv, m[1]);
      return { side: m[0], x: rv.cx + m[0] * (rv.hw - 22), y: m[1], near: 0 };
    });
    lv.Cr = (lv.crocs || []).map(function (c) {
      var rv = river(lv, c[1]);
      return { bx: rv.cx + c[0] * wk, y: c[1], amp: c[2] * rv.hw, w: c[3], ph: c[4] };
    });
    lv.Fa = (lv.falls || []).map(function (f) {
      var rv = river(lv, f[0]);
      return { y: f[0], drop: f[1], cx: rv.cx + f[2] * wk, hw: f[3] * wk, rcx: rv.cx, rhw: rv.hw };
    });
    lv.Bu = (lv.buoys || []).map(function (b) { return { x: river(lv, b[1]).cx + b[0] * wk, y: b[1], taken: false }; });
    lv.Is = (lv.islands || []).map(function (i) {
      return { x0: river(lv, i[1]).cx + i[0] * wk, y0: i[1], x1: river(lv, i[2]).cx + i[0] * wk, y1: i[2], r: i[3] };
    });
    lv.Wh = (lv.wheels || []).map(function (w) {
      var rv = river(lv, w[1]);
      return { x: rv.cx + w[0] * wk, y: w[1], R: w[2], h: w[3], w: w[4], nb: w[5], ph: w[1] * 0.01, rcx: rv.cx, rhw: rv.hw };
    });
    lv.Cn = (lv.cannons || []).map(function (c) {
      var rv = river(lv, c[1]);
      return { side: c[0], y: c[1], period: c[2], ph: c[3], speed: c[4] * wk, x0: rv.cx + c[0] * (rv.hw + 40), dist: 2 * rv.hw + 80, rcx: rv.cx, rhw: rv.hw };
    });
    lv.Gy = (lv.geysers || []).map(function (g) { return { x: river(lv, g[1]).cx + g[0] * wk, y: g[1], period: g[2], ph: g[3] }; });
    lv.Po = (lv.portals || []).map(function (p) {
      return { ax: river(lv, p[1]).cx + p[0] * wk, ay: p[1], bx: river(lv, p[3]).cx + p[2] * wk, by: p[3], fwd: p[3] > p[1] };
    });
    lv.Mi = (lv.mines || []).map(function (m) { return { x: river(lv, m[1]).cx + m[0] * wk, y: m[1], boomAt: -99 }; });
    lv.Jp = (lv.jumps || []).map(function (j) {
      var rv = river(lv, j[0] - 80);
      return { y: j[0], rise: j[1], ty: j[0] - 80, cx: rv.cx + j[2] * wk, hw: j[3] * wk, rcx: rv.cx, rhw: rv.hw };
    });
    // zapornice: [y, perioda (s), zamik] — vrata z obeh bregov se zapirajo proti sredini
    lv.Gt = (lv.gates || []).map(function (g) {
      var rv = river(lv, g[0]);
      return { y: g[0], cx: rv.cx, hw: rv.hw, period: g[1], ph: g[2], gap: rv.hw, open: 1 };
    });
  }
  // širina reke glede na število splavov
  function widthFor(n) { return n > 1 ? 1 + 0.55 * (n - 1) : 1; }

  LEVELS.forEach(function (lv) {
    // privzeto število prdcev na igralca — glede na težavnost in dolžino proge
    lv.farts = FART_DEFAULT[lv.name] || Math.round(lv.len / 80);
    prepareLevel(lv, 1);
  });

  /* =================== Konstante =================== */
  var RAFT = 58;            // polmer splava
  var RC = 74;              // polmer za trke (z živalmi)
  var MOVE = 2.4;           // rad/s po robu
  var MINGAP = 0.62;        // najmanjši kot med živalmi
  var CURRENT = 45;         // osnovni tok reke
  var DRAG = 0.9;
  var HIT = 8;              // vsak dotik ovire ali brega stane življenje (potem 2 s neranljivosti)
  var MAXL = 5;             // življenja splava
  var SPIKE_HIT = 8;        // bodice: enako kot drugje
  var GRAV = 110;           // hribčki: pospešek navzdol po klancu (višine so podvojene)
  var GATE_R = 12;          // debelina vrat zapornice
  var SPIN = 0.3;           // samodejno vrtenje splava (rad/s) pri 100 %
  function spinRate() { return SPIN * G.spin / 100; }

  var KEYS = [
    { l: ["KeyA"], r: ["KeyD"], f: ["KeyW"], label: ["A", "D", "W"] },
    { l: ["ArrowLeft"], r: ["ArrowRight"], f: ["ArrowUp"], label: ["←", "→", "↑"] },
    { l: ["KeyJ"], r: ["KeyL"], f: ["KeyI"], label: ["J", "L", "I"] },
    { l: ["Numpad4", "Digit4"], r: ["Numpad6", "Digit6"], f: ["Numpad8", "Digit8"], label: ["4", "6", "8"] }
  ];

  /* =================== Stanje =================== */
  var G = {
    mode: "kb",          // "kb" | "tel"
    phase: "menu",       // menu | lobby | count | play | end | over
    lv: 0, n: 2,
    time: 0,             // animacija (vedno teče)
    t: 0,                // čas vožnje
    count: 0,
    shake: 0,
    // splavi: vsak ima svoja življenja, neranljivost, padec in stanje v tekmi.
    // G.raft = splav, ki se trenutno obdeluje (fizika, trki); v igri z enim splavom vedno edini.
    rafts: [], raft: null, players: [], parts: [],
    teamSize: 0,         // 0 = vsi na enem splavu; 1–4 = tekma ekip (toliko igralcev na splav)
    raftMax: 4,          // največ splavov v tekmi (2 proti 2 → 2, 3 splavi po 2 → 3)
    crew: 4,             // en splav: največ igralcev (4, 6 ali 8)
    race: false,         // tekma teče (več kot en splav)
    raceEndT: null,      // odštevanje do konca tekme po prvem v cilju
    placeN: 0,
    zoom: 1,             // oddaljenost kamere (tekma: vsi splavi na zaslonu)
    cam: { x: 0, y: 0 }, camSpan: 0,
    refill: 0, refillT: 0, refillFlash: 0,   // polnjenje prdcev: vsakih „refill“ s (0 = izklopljeno)
    water: 100,                               // hitrost vode v % (100 = običajno, 0 = mirna voda)
    spin: 100,                                // samodejno vrtenje splava v % (0 = se ne vrti sam)
    fartDelta: 0, fartInf: false,   // nastavitev števila prdcev (± glede na progo, ali neomejeno)
    best: null, newRecord: false
  };
  var keysDown = {};

  function loadBest() {
    try { return JSON.parse(localStorage.getItem("prdoplav-best") || "{}") || {}; } catch (e) { return {}; }
  }
  function saveBest(b) {
    try { localStorage.setItem("prdoplav-best", JSON.stringify(b)); } catch (e) {}
  }
  G.best = loadBest();

  function fmt(t) {
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
  }

  function makePlayers(list) {
    return list.map(function (src) {
      return {
        slot: src.slot, uid: src.uid || null, name: src.name, team: src.team || 0, raft: 0,
        phi: 0,
        gas: 1, charge: 0, holding: false, puff: 0, left: Infinity,
        inp: { l: false, r: false, f: false }, lastIn: performance.now()
      };
    });
  }

  // igralci na tipkovnici; pri tekmi po vrsti v ekipe (npr. na splav 2: P1+P2, P3+P4)
  function kbList() {
    var out = [];
    for (var k = 0; k < G.n; k++) out.push({ slot: k, name: "P" + (k + 1), team: G.teamSize ? Math.min(G.raftMax - 1, Math.floor(k / G.teamSize)) : 0 });
    return out;
  }

  function newRaft(lv, i, n, team) {
    var rv = river(lv, 140);
    var x = rv.cx + (n > 1 ? (i - (n - 1) / 2) * (2 * rv.hw * 0.8 / n) : 0);
    return {
      x: x, y: 140, vx: 0, vy: 0, ang: i * 0.9, av: 0, team: team,
      lives: MAXL, inv: 0, fall: null, sink: null, air: null, portAt: -9,
      done: false, out: false, why: "", t: 0, place: 0, stuckY: 0, stuckT: 0, edgeT: 0
    };
  }

  // Splavi glede na ekipe igralcev (G.players[].team); reka se razširi glede na število splavov.
  function resetRaft(lv) {
    var teams = [];
    G.players.forEach(function (p) { if (teams.indexOf(p.team) < 0) teams.push(p.team); });
    if (!teams.length) teams.push(0);
    teams.sort(function (a, b) { return a - b; });
    var n = teams.length, wk = widthFor(n);
    if (lv.wk !== wk) prepareLevel(lv, wk);
    lv.Bu.forEach(function (b) { b.taken = false; });
    lv.Mi.forEach(function (m) { m.boomAt = -99; });
    G.rafts = teams.map(function (t, i) { return newRaft(lv, i, n, t); });
    G.race = n > 1;
    G.raft = G.rafts[0];
    // živali razporejene enakomerno po robu svojega splava
    teams.forEach(function (t, i) {
      var on = G.players.filter(function (p) { return p.team === t; });
      on.forEach(function (p, k) { p.raft = i; p.phi = -Math.PI / 2 - k * (2 * Math.PI / on.length); });
    });
    G.raceEndT = null; G.placeN = 0; G.zoom = 1;
    G.cam.x = river(lv, 140).cx; G.cam.y = 180;
  }
  function raftOf(p) { return G.rafts[p.raft] || G.rafts[0]; }

  function startLevel(i) {
    G.lv = i;
    var lv = LEVELS[i];
    var list;
    if (G.mode === "tel") {
      list = tel.players.filter(function (p) { return !p.waiting; });
    } else {
      list = kbList();
    }
    G.players = makePlayers(list);
    var lim = fartLimit(lv);
    G.players.forEach(function (p) { p.left = lim; });
    G.refillT = 0; G.refillFlash = 0;
    resetRaft(lv);
    G.t = 0; G.parts = []; G.newRecord = false;
    G.phase = "count"; G.count = 3.2;
    showOnly(null);
    $("btnPause").hidden = false;
    sound.unlock();
    pushState(true);
  }

  /* =================== Fizika =================== */
  function waterAt(lv, x, y) {
    // tok sledi ovinkom reke in rahlo vleče proti sredini (lažje skozi ovinke)
    var rv = river(lv, y), rv2 = river(lv, y + 30);
    var wx = CURRENT * (rv2.cx - rv.cx) / 30 + (rv.cx - x) * 0.12, wy = CURRENT;
    for (var i = 0; i < lv.F.length; i++) {
      var f = lv.F[i];
      if (y > f.y && y < f.y + f.h) {
        var k = Math.sin(Math.PI * (y - f.y) / f.h);
        wx += f.fx * k; wy += f.fy * k;
      }
    }
    for (var j = 0; j < lv.P.length; j++) {
      var p = lv.P[j], dx = x - p.x, dy = y - p.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < p.r * 1.6 && d > 1) {
        var s = 110 * p.str * Math.max(0, 1 - d / (p.r * 1.6));
        wx += -dy / d * s; wy += dx / d * s;
      }
    }
    var wk = G.water / 100; // nastavljena hitrost vode
    return { x: wx * wk, y: wy * wk };
  }

  function logX(l) { return l.bx + Math.sin(G.time * l.speed + l.ph) * l.amp; }
  function logV(l) { return Math.cos(G.time * l.speed + l.ph) * l.amp * l.speed; }

  function collide(nx, ny, pen, ovx, ovy, cx, cy, thr) {
    var r = G.raft;
    r.x += nx * pen; r.y += ny * pen;
    var rvx = r.vx - ovx, rvy = r.vy - ovy;
    var vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      r.vx -= 1.45 * vn * nx; r.vy -= 1.45 * vn * ny;
      var vt = rvx * -ny + rvy * nx;
      r.av += vt * 0.006;
      impact(-vn, cx, cy, thr);
    }
  }

  function impact(speed, x, y, thr) {
    var r = G.raft;
    if (speed > (thr || HIT) && r.inv <= 0 && !r.done && G.phase === "play") {
      r.lives--; r.inv = 2; G.shake = G.race ? 0.25 : 0.5;
      sound.bonk(1);
      splash(x, y, 26, thr ? "#fca5a5" : "#e0f2fe");
      if (r.lives <= 0) raftLost(r, "hit");
      else pushState(true);
    } else if (speed > 35) {
      sound.bonk(0.35);
      splash(x, y, 8, "#e0f2fe");
    }
  }

  // Vsi splavi: vsak svoja fizika, nato trki med splavi, polnjenje prdcev in konec tekme.
  function physics(dt) {
    var lv = LEVELS[G.lv];
    for (var i = 0; i < G.rafts.length; i++) {
      var r = G.rafts[i];
      if (r.out) continue;
      G.raft = r;
      if (r.inv > 0) r.inv = Math.max(0, r.inv - dt);
      if (r.fall) { if (G.phase === "play") updateFall(dt); continue; }
      if (r.sink) { if (G.phase === "play") updateSink(r, dt); continue; }
      if (r.air) { updateAir(r, dt); continue; }
      physicsRaft(r, dt);
    }
    G.raft = G.rafts[0];
    if (G.race) raftBumps();

    // polnjenje: vsakih G.refill s vsi spet dobijo izbrano število prdcev
    if (G.phase === "play" && G.refill > 0 && !G.fartInf) {
      G.refillT += dt;
      if (G.refillT >= G.refill) {
        G.refillT = 0;
        var full = fartLimit(lv);
        G.players.forEach(function (p) { p.left = full; });
        G.refillFlash = 1.2;
        sound.tune([523, 784]);
        pushState(true);
      }
    }
    G.refillFlash = Math.max(0, G.refillFlash - dt);
  }

  // Splava se odrineta drug od drugega (brez izgube življenja).
  function raftBumps() {
    for (var i = 0; i < G.rafts.length; i++) {
      for (var j = i + 1; j < G.rafts.length; j++) {
        var a = G.rafts[i], b = G.rafts[j];
        if (a.out || b.out || a.fall || b.fall || a.air || b.air) continue;
        var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d >= RC * 2 || d < 0.01) continue;
        var nx = dx / d, ny = dy / d, pen = (RC * 2 - d) / 2;
        a.x -= nx * pen; a.y -= ny * pen; b.x += nx * pen; b.y += ny * pen;
        var vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
          var jv = -vn * 0.9; // skoraj prožen odboj, enaki masi
          a.vx -= nx * jv; a.vy -= ny * jv; b.vx += nx * jv; b.vy += ny * jv;
          var vt = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
          a.av -= vt * 0.004; b.av += vt * 0.004;
          if (-vn > 35) { sound.bonk(0.4); splash(a.x + nx * RC, a.y + ny * RC, 10, "#e0f2fe"); }
        }
      }
    }
  }

  function physicsRaft(r, dt) {
    var lv = LEVELS[G.lv];
    var w = waterAt(lv, r.x, r.y);
    var k = 1 - Math.exp(-DRAG * (lv.ice || 1) * dt); // led: splav drsi
    r.vx += (w.x - r.vx) * k; r.vy += (w.y - r.vy) * k;

    for (var i = 0; i < lv.P.length; i++) {
      var p = lv.P[i], dx = p.x - r.x, dy = p.y - r.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < p.r && d > 1) {
        var f = (1 - d / p.r) * 150 * p.str;
        r.vx += dx / d * f * dt; r.vy += dy / d * f * dt;
        r.av += 2.2 * p.str * (1 - d / p.r) * dt;
      }
    }
    // hribček: navzdol pospeši, navzgor zavira
    r.vy -= GRAV * slopeAt(lv, r.y) * dt;
    // splav se sam počasi vrti okoli svoje osi; sunki trkov se umirijo nazaj na to hitrost
    r.av += (spinRate() - r.av) * (1 - Math.exp(-1.4 * dt));
    var y0 = r.y;
    r.x += r.vx * dt; r.y += r.vy * dt; r.ang += r.av * dt;
    if (G.phase === "play") specials(lv, r, y0);
    if (r.sink || r.air) return;

    // bregova (ob bodicah boli že rahel dotik)
    var rv = river(lv, r.y), rv2 = river(lv, r.y + 10);
    var left = rv.cx - rv.hw, right = rv.cx + rv.hw;
    var thr = spiky(lv, r.y) ? SPIKE_HIT : lv.soft ? 1e9 : 0; // gumijasti bregovi ne bolijo
    // brez ograje: ko je sredina splava čez rob, splav pade
    if (openSide(lv, r.y, "L")) {
      if (r.x < left && G.phase === "play") fallOff(-1);
    } else if (r.x - RC < left) {
      var sl = ((rv2.cx - rv2.hw) - left) / 10, ln = Math.sqrt(1 + sl * sl);
      collide(1 / ln, -sl / ln, (left - (r.x - RC)) / ln, 0, 0, r.x - RC, r.y, thr);
    }
    if (openSide(lv, r.y, "R")) {
      if (r.x > right && G.phase === "play") fallOff(1);
    } else if (r.x + RC > right) {
      var sr = ((rv2.cx + rv2.hw) - right) / 10, rn = Math.sqrt(1 + sr * sr);
      collide(-1 / rn, sr / rn, ((r.x + RC) - right) / rn, 0, 0, r.x + RC, r.y, thr);
    }
    // vrtiljaki: steber + kraki; krak splav odrine v smeri vrtenja
    for (var si = 0; si < lv.Sp.length; si++) {
      var sp = lv.Sp[si], dx0 = r.x - sp.x, dy0 = r.y - sp.y;
      if (Math.abs(dy0) > RC + sp.len + 10 || Math.abs(dx0) > RC + sp.len + 10) continue;
      var hd = Math.sqrt(dx0 * dx0 + dy0 * dy0);
      if (hd < RC + SPIN_HUB && hd > 0.01) collide(dx0 / hd, dy0 / hd, RC + SPIN_HUB - hd, 0, 0, sp.x + dx0 / hd * SPIN_HUB, sp.y + dy0 / hd * SPIN_HUB);
      var a0 = spinAng(sp);
      for (var ak = 0; ak < sp.angs.length; ak++) {
        var aa = a0 + sp.angs[ak], ex = Math.cos(aa), ey = Math.sin(aa);
        var tt = Math.max(0, Math.min(sp.len, (r.x - sp.x) * ex + (r.y - sp.y) * ey));
        var apx = sp.x + ex * tt, apy = sp.y + ey * tt, aqx = r.x - apx, aqy = r.y - apy, aqd = Math.sqrt(aqx * aqx + aqy * aqy);
        if (aqd < RC + SPIN_ARM && aqd > 0.01) collide(aqx / aqd, aqy / aqd, RC + SPIN_ARM - aqd, -ey * sp.w * tt, ex * sp.w * tt, apx, apy);
      }
    }
    // zapornice: dve vrati od bregov do reže na sredini
    for (var gi = 0; gi < lv.Gt.length; gi++) {
      var gt = lv.Gt[gi];
      segHit(gt.cx - gt.hw - 20, gt.cx - gt.gap, gt.y, GATE_R);
      segHit(gt.cx + gt.gap, gt.cx + gt.hw + 20, gt.y, GATE_R);
    }
    if (r.y < 60) { r.y = 60; if (r.vy < 0) r.vy = 0; }

    // skale
    for (var j = 0; j < lv.R.length; j++) {
      var o = lv.R[j], ox = r.x - o.x, oy = r.y - o.y, od = Math.sqrt(ox * ox + oy * oy);
      if (od < RC + o.r && od > 0.01) collide(ox / od, oy / od, RC + o.r - od, 0, 0, o.x + ox / od * o.r, o.y + oy / od * o.r);
    }
    // otočki med rokavi (trd udarec stane življenje)
    for (var ii = 0; ii < lv.Is.length; ii++) {
      var is = lv.Is[ii];
      if (r.y < is.y0 - RC - is.r || r.y > is.y1 + RC + is.r) continue;
      var ix = is.x1 - is.x0, iy = is.y1 - is.y0, il = ix * ix + iy * iy;
      var it = Math.max(0, Math.min(1, ((r.x - is.x0) * ix + (r.y - is.y0) * iy) / il));
      var ipx = is.x0 + ix * it, ipy = is.y0 + iy * it, idx = r.x - ipx, idy = r.y - ipy, idd = Math.sqrt(idx * idx + idy * idy);
      if (idd < RC + is.r && idd > 0.01) collide(idx / idd, idy / idd, RC + is.r - idd, 0, 0, ipx + idx / idd * is.r, ipy + idy / idd * is.r, 60);
    }
    // mlinska kolesa: lopate pod vodo
    for (var wi = 0; wi < lv.Wh.length; wi++) {
      var wh = lv.Wh[wi];
      if (Math.abs(r.y - wh.y) > RC + WHEEL_T) continue;
      wheelSegs(wh).forEach(function (sg) {
        var px = Math.max(sg.x1, Math.min(sg.x2, r.x)), qx = r.x - px, qy = r.y - wh.y, qd = Math.sqrt(qx * qx + qy * qy);
        if (qd < RC + WHEEL_T && qd > 0.01) collide(qx / qd, qy / qd, RC + WHEEL_T - qd, sg.vx, 0, px, wh.y);
      });
    }
    // krokodili (ugriz stane življenje že pri rahlem dotiku)
    for (var ci = 0; ci < lv.Cr.length; ci++) {
      var cr = lv.Cr[ci];
      if (Math.abs(r.y - cr.y) > RC + CROC_R + 5) continue;
      var cxp = crocX(cr), cpx = Math.max(cxp - CROC_HALF, Math.min(cxp + CROC_HALF, r.x));
      var cqx = r.x - cpx, cqy = r.y - cr.y, cqd = Math.sqrt(cqx * cqx + cqy * cqy);
      if (cqd < RC + CROC_R && cqd > 0.01) collide(cqx / cqd, cqy / cqd, RC + CROC_R - cqd, crocV(cr), 0, cpx, cr.y, 1);
    }
    // hlodi
    for (var m = 0; m < lv.L.length; m++) {
      var l = lv.L[m], lx = logX(l);
      var px = Math.max(lx - l.half, Math.min(lx + l.half, r.x)), py = l.y;
      var qx = r.x - px, qy = r.y - py, qd = Math.sqrt(qx * qx + qy * qy);
      if (qd < RC + LOG_R && qd > 0.01) collide(qx / qd, qy / qd, RC + LOG_R - qd, logV(l), 0, px, py);
    }

    if (r.y >= lv.len && G.phase === "play" && !r.done) raftDone(r);
    // vsem na splavu je zmanjkalo prdcev: če splav 4 s ne napreduje, je zanj konec
    var crew = G.players.filter(function (p) { return G.rafts[p.raft] === r; });
    if (G.phase === "play" && !r.done && crew.length && crew.every(function (p) { return p.left <= 0; })) {
      if (r.y > r.stuckY + 25) { r.stuckY = r.y; r.stuckT = 0; }
      else if ((r.stuckT += dt) > 4) raftLost(r, "gas");
    } else { r.stuckY = r.y; r.stuckT = 0; }
  }

  /* Konec za posamezen splav. En splav: konec igre kot doslej. Tekma: splav je v cilju
     ali izpade; tekma se konča, ko so vsi v cilju ali izpadli (ali 30 s po prvem v cilju). */
  var RACE_GRACE = 30;
  function raftDone(r) {
    if (!G.race) { finish(true); return; }
    r.done = true; r.t = G.t; r.place = ++G.placeN; r.inv = 1e9;
    sound.tune(r.place === 1 ? [523, 659, 784, 1047] : [523, 659]);
    splash(r.x, r.y, 30, "#d9f99d");
    if (r.place === 1) G.raceEndT = RACE_GRACE;
    checkRaceEnd();
    pushState(true);
  }
  function raftLost(r, why) {
    if (!G.race) { finish(false, why); return; }
    r.out = true; r.why = why; r.fall = null;
    sound.tune([392, 330, 262]);
    splash(r.x, r.y, 30, "#fca5a5");
    checkRaceEnd();
    pushState(true);
  }
  function checkRaceEnd() {
    if (G.phase !== "play") return;
    var left = G.rafts.filter(function (r) { return !r.done && !r.out; }).length;
    var anyDone = G.rafts.some(function (r) { return r.done; });
    // vsi končali, poteklo odštevanje ali pa je ostal en sam splav (ostali izpadli) → zmaga
    if (!left || (G.raceEndT !== null && G.raceEndT <= 0) || (left === 1 && !anyDone)) finishRace();
  }

  /* Posebnosti proge Povodni mož: slapovi (žleb), povodni možje (potopijo), rešilni obroči. */
  function specials(lv, r, y0) {
    // slap: navzgor se ne da; čez rob izven žleba stane življenje, v žlebu pospeši
    for (var i = 0; i < lv.Fa.length; i++) {
      var f = lv.Fa[i];
      if (y0 > f.y && r.y <= f.y) { r.y = f.y + 1; if (r.vy < 0) r.vy = 0; continue; }
      if (!(y0 < f.y && r.y >= f.y)) continue;
      if (Math.abs(r.x - f.cx) <= f.hw) {
        r.vy += 90;
        splash(r.x, r.y + 30, 24, "#e0f2fe");
        sound.tune([659, 880]);
      } else {
        r.vy *= 0.5; r.av += (Math.random() < 0.5 ? -1 : 1) * 2.5;
        splash(r.x, r.y + 30, 34, "#e0f2fe");
        impact(1e9, r.x, r.y, 1);
      }
    }
    // topovske krogle
    for (var ci = 0; ci < lv.Cn.length; ci++) {
      var cn = lv.Cn[ci];
      if (Math.abs(r.y - cn.y) > RC + BALL_R) continue;
      var bl = cannonBall(cn);
      if (!bl.on) continue;
      var bdx = r.x - bl.x, bdy = r.y - cn.y, bd = Math.sqrt(bdx * bdx + bdy * bdy);
      if (bd < RC + BALL_R && bd > 0.01) collide(bdx / bd, bdy / bd, RC + BALL_R - bd, -cn.side * cn.speed, 0, bl.x, cn.y, 1);
    }
    // mine
    for (var mi = 0; mi < lv.Mi.length; mi++) {
      var mn = lv.Mi[mi];
      if (Math.abs(r.y - mn.y) > RC + MINE_R || !mineOn(mn)) continue;
      var mdx = r.x - mn.x, mdy = r.y - mn.y, md = Math.sqrt(mdx * mdx + mdy * mdy);
      if (md >= RC + MINE_R || md < 0.01) continue;
      mn.boomAt = G.time;
      r.vx += mdx / md * 260; r.vy += mdy / md * 260; r.av += (Math.random() < 0.5 ? -1 : 1) * 3;
      G.shake = Math.max(G.shake, 0.6);
      splash(mn.x, mn.y, 40, "#fb923c"); splash(mn.x, mn.y, 20, "#fde047");
      impact(1e9, mn.x, mn.y, 1);
    }
    // gejzir izbruhne pod splavom → splav odleti naprej (malo vstran)
    for (var gi = 0; gi < lv.Gy.length; gi++) {
      var gy = lv.Gy[gi];
      if (Math.abs(r.y - gy.y) > GEY_R + RC || Math.abs(r.x - gy.x) > GEY_R + RC) continue;
      if (!geyserState(gy).up || Math.hypot(r.x - gy.x, r.y - gy.y) > GEY_R + RC * 0.45) continue;
      var gy1 = r.y + 300, grv = river(lv, gy1), grv0 = river(lv, r.y);
      var goff = Math.max(-(grv.hw - 80), Math.min(grv.hw - 80, r.x - grv0.cx + (Math.random() - 0.5) * 200));
      r.air = { t: 0, x0: r.x, y0: r.y, x1: grv.cx + goff, y1: gy1, peak: 210 };
      r.vx = 0; r.vy = 0; r.av += (Math.random() < 0.5 ? -1 : 1) * 2;
      sound.tune([330, 440, 660]);
      splash(r.x, r.y, 30, "#f8fafc");
      pushState(true);
      return;
    }
    // portali
    for (var pi = 0; pi < lv.Po.length; pi++) {
      var po = lv.Po[pi];
      if (Math.hypot(r.x - po.ax, r.y - po.ay) > PORT_R + RC * 0.4 || G.time - (r.portAt || -9) < 1) continue;
      splash(r.x, r.y, 20, po.fwd ? "#93c5fd" : "#fdba74");
      r.x = po.bx; r.y = po.by; r.portAt = G.time;
      r.inv = Math.max(r.inv, 0.8);
      splash(r.x, r.y, 24, po.fwd ? "#93c5fd" : "#fdba74");
      sound.tune(po.fwd ? [523, 659, 784, 1047] : [784, 659, 523, 392]);
      pushState(true);
      return;
    }
    // trampolin: kdor ga prečka naprej, odleti čez steno; drugje stena odbije nazaj
    for (var jj = 0; jj < lv.Jp.length; jj++) {
      var jp = lv.Jp[jj];
      if (y0 < jp.ty && r.y >= jp.ty && Math.abs(r.x - jp.cx) <= jp.hw) {
        var y1 = jp.y + 170, rv1 = river(lv, y1);
        var off = Math.max(-(rv1.hw - 70), Math.min(rv1.hw - 70, r.x - river(lv, r.y).cx));
        r.air = { t: 0, x0: r.x, y0: r.y, x1: rv1.cx + off, y1: y1, peak: jp.rise + JUMP_PEAK };
        r.vx = 0; r.vy = 0;
        sound.tune([392, 523, 784]);
        splash(r.x, r.y, 20, "#bfdbfe");
        pushState(true);
        return;
      }
      if (y0 < jp.y && r.y >= jp.y) {
        r.y = jp.y - 1; r.vy = -Math.max(40, Math.abs(r.vy) * 0.4);
        splash(r.x, jp.y, 10, "#e0f2fe"); sound.bonk(0.4);
      }
    }
    // povodni mož: rob splava preblizu → zgrabi in potopi
    for (var j = 0; j < lv.Pm.length; j++) {
      var pm = lv.Pm[j], dx = r.x - pm.x, dy = r.y - pm.y;
      if (Math.abs(dy) > PM_WARN + RC) continue;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < RC + PM_GRAB && !r.done) {
        r.sink = { t: 0, pm: pm };
        r.vx = 0; r.vy = 0;
        G.shake = 0.6;
        sound.tune([294, 247, 196, 147]);
        splash(r.x, r.y, 36, "#14532d");
        pushState(true);
        return;
      }
    }
    // rešilni obroč: +1 življenje (pri polnih +3 prdci vsem na splavu); vzame ga prvi splav
    for (var k = 0; k < lv.Bu.length; k++) {
      var b = lv.Bu[k];
      if (b.taken) continue;
      var bx = r.x - b.x, by = r.y - b.y;
      if (bx * bx + by * by > (RC + BUOY_R) * (RC + BUOY_R)) continue;
      b.taken = true;
      if (r.lives < MAXL) r.lives++;
      else G.players.forEach(function (p) { if (G.rafts[p.raft] === r && p.left !== Infinity) p.left += 3; });
      splash(b.x, b.y, 22, "#fecaca");
      sound.tune([784, 988, 1175]);
      pushState(true);
    }
  }
  // Povodni mož vleče splav k sebi in pod vodo; nato je splava konec.
  function updateSink(r, dt) {
    var sk = r.sink;
    sk.t += dt / PM_SINK;
    var k = 1 - Math.exp(-3 * dt);
    r.x += (sk.pm.x - r.x) * k; r.y += (sk.pm.y - r.y) * k;
    r.ang += 3 * dt;
    if (Math.random() < 0.4) splash(r.x + (Math.random() - 0.5) * 60, r.y + (Math.random() - 0.5) * 60, 2, "#14532d");
    if (sk.t < 1) return;
    r.sink = null; r.lives = 0; r.out = true;
    raftLost(r, "sink");
  }
  function updateAir(r, dt) {
    var a = r.air;
    a.t += dt / JUMP_TIME;
    var k = Math.min(1, a.t);
    r.x = a.x0 + (a.x1 - a.x0) * k; r.y = a.y0 + (a.y1 - a.y0) * k;
    r.ang += r.av * dt;
    if (a.t < 1) return;
    r.air = null; r.vx = 0; r.vy = 90;
    G.shake = Math.max(G.shake, 0.3);
    sound.bonk(0.7);
    splash(r.x, r.y, 30, "#e0f2fe");
  }
  function whyText(why) { return why === "gas" ? "brez prdcev" : why === "edge" ? "zaostal" : why === "sink" ? "potonil" : "razpadel"; }

  // Padec čez rob: kratka animacija, izgubljeno življenje, splav se vrne nekoliko nazaj na sredino.
  var FALL_TIME = 1.1;
  function fallOff(side) {
    var r = G.raft;
    if (r.fall || r.done) return;
    r.fall = { t: 0, side: side };
    G.shake = 0.4;
    sound.bonk(0.8);
    splash(r.x, r.y, 20, "#e0f2fe");
  }
  function updateFall(dt) {
    var r = G.raft, f = r.fall;
    f.t += dt / FALL_TIME;
    r.x += f.side * 120 * dt; r.ang += 2.5 * dt; // odnese čez rob in zavrti
    if (f.t < 1) return;
    r.fall = null;
    r.lives--;
    if (r.lives <= 0) { raftLost(r, "hit"); return; }
    var lv = LEVELS[G.lv], back = Math.max(140, r.y - 220);
    r.x = river(lv, back).cx; r.y = back; r.vx = 0; r.vy = 0; r.av = spinRate();
    r.inv = 2;
    pushState(true);
  }

  function segHit(x0, x1, y, rad) {
    if (x1 <= x0) return;
    var r = G.raft;
    var px = Math.max(x0, Math.min(x1, r.x));
    var qx = r.x - px, qy = r.y - y, qd = Math.sqrt(qx * qx + qy * qy);
    if (qd < RC + rad && qd > 0.01) collide(qx / qd, qy / qd, RC + rad - qd, 0, 0, px, y);
  }

  // Zapornice se odpirajo in zapirajo. Senzor: dokler je splav v vratih, se ne zapirajo naprej.
  function updateGates(dt) {
    var lv = LEVELS[G.lv];
    lv.Gt.forEach(function (g) {
      g.open = Math.max(0, Math.min(1, 0.5 + 0.9 * Math.sin(2 * Math.PI * G.time / g.period + g.ph)));
      var target = 4 + g.open * (g.hw - 4);
      var inGate = G.rafts.some(function (r) { return !r.out && Math.abs(r.y - g.y) < RC + GATE_R + 6; });
      if (inGate && target < g.gap) target = g.gap;
      var sp = 150 * dt;
      g.gap += Math.max(-sp, Math.min(sp, target - g.gap));
    });
  }

  function angDist(a, b) {
    var d = (a - b) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d);
  }

  function updatePlayers(dt, canFart) {
    var now = performance.now();
    G.players.forEach(function (p) {
      if (G.mode === "kb") {
        var k = KEYS[p.slot];
        p.inp.l = k.l.some(function (c) { return keysDown[c]; });
        p.inp.r = k.r.some(function (c) { return keysDown[c]; });
        p.inp.f = k.f.some(function (c) { return keysDown[c]; });
      } else if (now - p.lastIn > 2500) {
        p.inp.l = p.inp.r = p.inp.f = false;
      }
      var d = (p.inp.r ? 1 : 0) - (p.inp.l ? 1 : 0);
      if (d) {
        var np = p.phi + d * MOVE * dt; // levo = v smeri urinega kazalca (žival gleda proti sredini)
        var blocked = G.players.some(function (o) { return o !== p && o.raft === p.raft && angDist(o.phi, np) < MINGAP && angDist(o.phi, np) < angDist(o.phi, p.phi); });
        if (!blocked) p.phi = np;
      }
      var rf = raftOf(p);
      if (canFart && !rf.fall && !rf.out && !rf.sink && !rf.air) {
        if (p.inp.f) p.charge = Math.min(1, p.charge + dt / 0.9);
        else if (p.holding) fart(p);
        p.holding = p.inp.f;
      } else { p.holding = false; p.charge = 0; }
      p.gas = Math.min(1, p.gas + dt * 0.3);
      p.puff = Math.max(0, p.puff - dt);
    });
  }

  function animalPos(p) {
    var r = raftOf(p), a = r.ang + p.phi;
    return { a: a, x: r.x + Math.cos(a) * RAFT, y: r.y + Math.sin(a) * RAFT };
  }

  // Koliko prdcev ima vsak igralec na tej progi (Infinity = neomejeno).
  function fartLimit(lv) {
    return G.fartInf ? Infinity : Math.max(1, lv.farts + G.fartDelta);
  }

  function fart(p) {
    var c = p.charge;
    p.charge = 0;
    if (p.left <= 0) {
      // zmanjkalo prdcev: samo tihi „pff“ brez potiska
      var e = animalPos(p);
      puffs(e.x + Math.cos(e.a) * 12, e.y + Math.sin(e.a) * 12, Math.cos(e.a), Math.sin(e.a), 2, 0.1);
      sound.fart(0.03, p.slot);
      return;
    }
    var cost = 0.16 + 0.34 * c;
    var k = p.gas >= cost ? 1 : Math.max(0, p.gas / cost);
    p.gas = Math.max(0, p.gas - cost);
    var rf = raftOf(p);
    var pos = animalPos(p), cos = Math.cos(pos.a), sin = Math.sin(pos.a);
    if (k < 0.15) {
      puffs(pos.x + cos * 12, pos.y + sin * 12, cos, sin, 3, 0.2, rf);
      sound.fart(0.05, p.slot);
      return;
    }
    p.left--;
    var power = (70 + 160 * c) * k; // prej 110 + 250 * c — prdec premakne manj
    rf.vx -= cos * power; rf.vy -= sin * power;
    rf.av += (Math.random() - 0.5) * 0.4 * c;
    p.puff = 0.35;
    puffs(pos.x + cos * 12, pos.y + sin * 12, cos, sin, Math.round(8 + 22 * c * k), 0.4 + c * k, rf);
    sound.fart(Math.max(0.2, c * k), p.slot);
    sendBuzz(p);
  }

  /* =================== Delci =================== */
  var PUFF = ["#bef264", "#a3e635", "#d9f99d", "#84cc16", "#ca8a04"];
  function puffs(x, y, dx, dy, n, s, rf) {
    rf = rf || G.raft;
    for (var i = 0; i < n; i++) {
      var sp = (60 + 180 * s) * (0.5 + Math.random());
      var ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.1;
      G.parts.push({
        x: x, y: y, vx: Math.cos(ang) * sp + rf.vx * 0.3, vy: Math.sin(ang) * sp + rf.vy * 0.3,
        life: 0, max: 0.7 + Math.random() * 0.8, r: 6 + Math.random() * 10 * (0.6 + s), col: PUFF[i % PUFF.length], grow: 1
      });
    }
  }
  function splash(x, y, n, col) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140;
      G.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.4 + Math.random() * 0.4, r: 2 + Math.random() * 4, col: col, grow: 0 });
    }
  }
  function updateParts(dt) {
    for (var i = G.parts.length - 1; i >= 0; i--) {
      var p = G.parts[i];
      p.life += dt;
      if (p.life >= p.max) { G.parts.splice(i, 1); continue; }
      var dr = Math.exp(-2.2 * dt);
      p.vx *= dr; p.vy *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    if (G.parts.length > 600) G.parts.splice(0, G.parts.length - 600);
  }

  /* =================== Zvok (Web Audio, brez datotek) =================== */
  var sound = (function () {
    var ac = null, noise = null;
    function unlock() {
      if (!ac) {
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
        var len = ac.sampleRate;
        noise = ac.createBuffer(1, len, ac.sampleRate);
        var d = noise.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === "suspended") ac.resume();
    }
    /* Vsaka žival ima svoj prdec (slot = mesto igralca):
       krava globok bobneč, pujs visok cviljenje, koza tresoč meketajoč, raca kratek račji „ga-ga-ga“. */
    var VOICES = [
      { type: "sawtooth", base: 62, drop: 0.6, lfo: 12, depth: 0.3, filter: 380, noise: 180, nGain: 0.6, trem: 0, len: 1.15 },  // krava
      { type: "square", base: 190, drop: 0.7, lfo: 28, depth: 0.22, filter: 1400, noise: 700, nGain: 0.25, trem: 0, len: 0.8 },  // pujs
      { type: "triangle", base: 120, drop: 0.8, lfo: 38, depth: 0.55, filter: 900, noise: 380, nGain: 0.4, trem: 9, len: 1.0 },  // koza
      { type: "sawtooth", base: 240, drop: 0.85, lfo: 20, depth: 0.15, filter: 1100, noise: 900, nGain: 0.3, trem: 16, len: 0.7 } // raca
    ];
    var DEFAULT_VOICE = { type: "sawtooth", base: 95, drop: 0.55, lfo: 24, depth: 0.35, filter: 600, noise: 260, nGain: 0.5, trem: 0, len: 1 };

    function fart(p, slot) {
      if (!ac) return;
      var v = VOICES[slot % 4] || DEFAULT_VOICE;
      var t = ac.currentTime, dur = (0.18 + 0.55 * p) * v.len;
      var g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35 + 0.35 * p, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(ac.destination);

      // tresenje glasnosti (koza, raca) — prek vmesne ojačitve
      var out = g;
      if (v.trem) {
        var tg = ac.createGain(), tl = ac.createOscillator(), td = ac.createGain();
        tg.gain.value = 0.6; tl.type = "square"; tl.frequency.value = v.trem; td.gain.value = 0.4;
        tl.connect(td); td.connect(tg.gain); tg.connect(g);
        tl.start(t); tl.stop(t + dur);
        out = tg;
      }

      var o = ac.createOscillator();
      o.type = v.type;
      var base = v.base * (1 - 0.3 * p) * (0.9 + Math.random() * 0.2);
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * v.drop, t + dur);
      var lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = v.lfo * (0.85 + Math.random() * 0.3);
      lg.gain.value = base * v.depth;
      lfo.connect(lg); lg.connect(o.frequency);
      var lp = ac.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = v.filter * (1 + 0.6 * p);
      o.connect(lp); lp.connect(out);

      var n = ac.createBufferSource(), bp = ac.createBiquadFilter(), ng = ac.createGain();
      n.buffer = noise; bp.type = "bandpass"; bp.frequency.value = v.noise; bp.Q.value = 0.9;
      ng.gain.value = v.nGain;
      n.connect(bp); bp.connect(ng); ng.connect(out);

      o.start(t); lfo.start(t); n.start(t);
      o.stop(t + dur); lfo.stop(t + dur); n.stop(t + dur);
    }
    function bonk(p) {
      if (!ac) return;
      var t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
      g.gain.setValueAtTime(0.5 * p, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + 0.3);
    }
    function tune(notes) {
      if (!ac) return;
      var t = ac.currentTime;
      notes.forEach(function (f, i) {
        var o = ac.createOscillator(), g = ac.createGain(), s = t + i * 0.13;
        o.type = "square"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.12, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.22);
        o.connect(g); g.connect(ac.destination);
        o.start(s); o.stop(s + 0.24);
      });
    }
    return { unlock: unlock, fart: fart, bonk: bonk, tune: tune };
  })();

  /* =================== Konec proge =================== */
  function finish(won, why) {
    G.phase = won ? "end" : "over";
    var lv = LEVELS[G.lv];
    $("btnPause").hidden = true;
    if (won) {
      var prev = G.best[lv.name];
      G.newRecord = !prev || G.t < prev;
      if (G.newRecord) { G.best[lv.name] = G.t; saveBest(G.best); }
      sound.tune([523, 659, 784, 1047]);
      $("endTitle").textContent = "Na cilju!";
      $("endTime").textContent = fmt(G.t);
      $("endInfo").innerHTML = G.newRecord ? '<span class="rec">Nov rekord za progo ' + lv.name + "!</span>"
        : "Rekord: " + fmt(prev);
    } else {
      sound.tune([392, 330, 262, 196]);
      $("endTitle").textContent = why === "gas" ? "Zmanjkalo je prdcev" : why === "sink" ? "Povodni mož vas je potegnil pod vodo" : "Splav je razpadel";
      $("endTime").textContent = Math.round(Math.min(1, G.raft.y / lv.len) * 100) + " % proge";
      $("endInfo").textContent = why === "gas" ? "Splav je obstal. Poskusi z več prdci ali bolj premišljeno."
        : why === "sink" ? "Ne hodi preblizu temnih vrtincev ob robu. Še enkrat?" : "Splav je dobil preveč udarcev. Še enkrat?";
    }
    var hasNext = won && G.lv < LEVELS.length - 1;
    $("btnNext").hidden = !hasNext;
    $("btnRetry").textContent = won ? "Ponovi" : "Še enkrat";
    if (G.mode === "tel") tel.admitWaiting();
    setTimeout(function () { if (G.phase === "end" || G.phase === "over") showOnly("end"); }, won ? 900 : 1100);
    pushState(true);
    renderLevels();
  }

  // Razvrstitev: najprej v cilju po mestu, nato po prevoženi poti, izpadli na koncu.
  function ranking() {
    return G.rafts.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? -1 : 1;
      if (a.done) return a.place - b.place;
      if (a.out !== b.out) return a.out ? 1 : -1;
      return b.y - a.y;
    });
  }
  function crewNames(r) {
    return G.players.filter(function (p) { return G.rafts[p.raft] === r; })
      .map(function (p) { return G.mode === "tel" ? p.name : "P" + (p.slot + 1); }).join(", ");
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function finishRace() {
    var lv = LEVELS[G.lv], rank = ranking(), win = rank[0];
    var anyDone = rank.some(function (r) { return r.done; }) || !win.out; // preživeli zmaga tudi brez cilja
    G.phase = anyDone ? "end" : "over";
    $("btnPause").hidden = true;
    sound.tune(anyDone ? [523, 659, 784, 1047] : [392, 330, 262, 196]);
    $("endTitle").textContent = anyDone ? "Zmaga: " + TEAMS[win.team].name + " splav!" : "Vsi splavi so izpadli";
    $("endTime").textContent = anyDone ? (win.done ? fmt(win.t) : "Edini preživeli") : Math.round(Math.min(1, win.y / lv.len) * 100) + " % proge";
    var html = '<ol class="rank">';
    rank.forEach(function (r, i) {
      var st = r.done ? fmt(r.t) : r.out ? whyText(r.why) : Math.round(Math.min(1, r.y / lv.len) * 100) + " %";
      html += '<li><b style="background:' + TEAMS[r.team].c + '">' + (i + 1) + "</b>" +
        '<span class="rn">' + esc(TEAMS[r.team].name) + ' <small>' + esc(crewNames(r)) + "</small></span>" +
        '<span class="rt">' + st + "</span></li>";
    });
    $("endInfo").innerHTML = html + "</ol>";
    var hasNext = anyDone && G.lv < LEVELS.length - 1;
    $("btnNext").hidden = !hasNext;
    $("btnRetry").textContent = "Še enkrat";
    if (G.mode === "tel") tel.admitWaiting();
    setTimeout(function () { if (G.phase === "end" || G.phase === "over") showOnly("end"); }, 1200);
    pushState(true);
    renderLevels();
  }

  /* =================== Izris =================== */
  function sx(x) { return W / 2 + (x - G.cam.x) * S + shX; }
  function sy(y) { return H * 0.6 - (y - G.cam.y) * S + shY; }
  var shX = 0, shY = 0;

  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  function draw() {
    var S0 = S;
    S = S * G.zoom; // tekma: kamera oddaljena, da so vsi splavi na zaslonu
    try { drawWorld(); } finally { S = S0; }
    drawHud(LEVELS[G.lv]);
  }

  function drawWorld() {
    var lv = LEVELS[G.lv];
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    shX = shY = 0;
    if (G.shake > 0) { shX = (Math.random() - 0.5) * 16 * G.shake; shY = (Math.random() - 0.5) * 16 * G.shake; }

    ctx.fillStyle = lv.noFence ? "#2a211c" : "#3f8f3a"; // brez ograje: globoka soteska
    ctx.fillRect(0, 0, W, H);

    var yTop = G.cam.y + (H * 0.6) / S + 80;
    var yBot = G.cam.y - (H * 0.4) / S - 80;
    var step = 24, y;

    // trava in grmi
    var g0 = Math.floor(yBot / 70) * 70;
    for (y = g0; y < yTop && !lv.noFence; y += 70) {
      var rv = river(lv, y);
      for (var side = -1; side <= 1; side += 2) {
        for (var q = 0; q < 3; q++) {
          var h = hash(y * 0.13 + side * 7 + q * 31);
          var bx = rv.cx + side * (rv.hw + 50 + h * 320 + q * 120);
          var by = y + hash(y + q) * 60;
          var br = (12 + hash(y * 3 + q + side) * 20) * S;
          ctx.fillStyle = q === 1 ? "#2f6f2d" : "#356f2c";
          ctx.beginPath(); ctx.arc(sx(bx), sy(by), br, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(190, 242, 100, 0.25)";
          ctx.beginPath(); ctx.arc(sx(bx) - br * 0.3, sy(by) - br * 0.3, br * 0.45, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // pesek ob bregu + voda
    riverPath(lv, yBot, yTop, step, 16);
    ctx.fillStyle = lv.noFence ? "#94a3b8" : "#e7cf96"; ctx.fill();
    // gumijasti bregovi: oranžen rob
    if (lv.soft) {
      ctx.strokeStyle = "#f97316"; ctx.lineWidth = 7 * S;
      [-1, 1].forEach(function (sd) {
        ctx.beginPath();
        for (var yy2 = yBot; yy2 <= yTop; yy2 += 12) { var rr2 = river(lv, yy2); ctx.lineTo(sx(rr2.cx + sd * rr2.hw), sy(yy2)); }
        ctx.stroke();
      });
    }
    // odseki brez ograje: zunaj roba je prepad
    (lv.open || []).forEach(function (o) {
      var a0 = Math.max(o[0], yBot), a1 = Math.min(o[1], yTop);
      if (a1 <= a0) return;
      ["L", "R"].forEach(function (side) {
        if (o[2] !== "B" && o[2] !== side) return;
        var s = side === "L" ? -1 : 1, yy, rr;
        ctx.beginPath();
        for (yy = a0; yy <= a1; yy += 12) { rr = river(lv, yy); ctx.lineTo(sx(rr.cx + s * rr.hw), sy(yy)); }
        rr = river(lv, a1); ctx.lineTo(sx(rr.cx + s * (rr.hw + 900)), sy(a1));
        rr = river(lv, a0); ctx.lineTo(sx(rr.cx + s * (rr.hw + 900)), sy(a0));
        ctx.closePath();
        ctx.fillStyle = "#2a211c"; ctx.fill();
        ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 6 * S;
        ctx.beginPath();
        for (yy = a0; yy <= a1; yy += 12) { rr = river(lv, yy); ctx.lineTo(sx(rr.cx + s * (rr.hw + 3)), sy(yy)); }
        ctx.stroke();
      });
    });
    riverPath(lv, yBot, yTop, step, 0);
    var grd = ctx.createLinearGradient(0, 0, W, 0);
    if (lv.ice) { grd.addColorStop(0, "#9cc9e6"); grd.addColorStop(0.5, "#c7e3f4"); grd.addColorStop(1, "#9cc9e6"); }
    else { grd.addColorStop(0, "#2f86cf"); grd.addColorStop(0.5, "#3b9ae1"); grd.addColorStop(1, "#2f86cf"); }
    ctx.fillStyle = grd; ctx.fill();

    // črte toka
    ctx.save();
    riverPath(lv, yBot, yTop, step, 0); ctx.clip();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 2 * S; ctx.lineCap = "round";
    var off = (G.time * 60) % 90;
    for (y = Math.floor(yBot / 90) * 90; y < yTop; y += 90) {
      var r2 = river(lv, y);
      for (var s = 0; s < 4; s++) {
        var hx = hash(y * 0.7 + s * 13);
        var lx = r2.cx + (hx * 2 - 1) * r2.hw * 0.85, ly = y + off + hash(s + y) * 40;
        ctx.beginPath(); ctx.moveTo(sx(lx), sy(ly)); ctx.lineTo(sx(lx), sy(ly + 26)); ctx.stroke();
      }
    }
    // tokovi (puščice)
    lv.F.forEach(function (f) {
      if (f.y > yTop || f.y + f.h < yBot) return;
      var a = Math.atan2(f.fy + CURRENT, f.fx);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.32)"; ctx.lineWidth = 3 * S;
      for (var yy = f.y + 30; yy < f.y + f.h - 20; yy += 60) {
        var rr = river(lv, yy), sh = ((G.time * 50) % 60);
        for (var xx = -1; xx <= 1; xx++) {
          var cx = rr.cx + xx * rr.hw * 0.55 + Math.cos(a) * (sh - 30), cy = yy + Math.sin(a) * (sh - 30);
          chevron(sx(cx), sy(cy), -a, 12 * S);
        }
      }
    });
    // hribčki: navzgor temneje, navzdol svetlo s peno
    if (lv.hills) {
      for (y = Math.floor(yBot / step) * step; y < yTop; y += step) {
        var sl2 = slopeAt(lv, y + step / 2);
        if (Math.abs(sl2) < 0.03) continue;
        var rh = river(lv, y), rh2 = river(lv, y + step);
        ctx.fillStyle = sl2 > 0 ? "rgba(8, 30, 60, " + Math.min(0.35, sl2 * 0.9) + ")"
          : "rgba(255, 255, 255, " + Math.min(0.35, -sl2 * 0.9) + ")";
        ctx.beginPath();
        ctx.moveTo(sx(rh.cx - rh.hw), sy(y)); ctx.lineTo(sx(rh.cx + rh.hw), sy(y));
        ctx.lineTo(sx(rh2.cx + rh2.hw), sy(y + step)); ctx.lineTo(sx(rh2.cx - rh2.hw), sy(y + step));
        ctx.closePath(); ctx.fill();
        if (sl2 < -0.12 && Math.floor(y / step) % 3 === 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 3 * S;
          for (var fx = -2; fx <= 2; fx++) chevron(sx(rh.cx + fx * rh.hw * 0.35), sy(y + ((G.time * 80) % step)), -Math.PI / 2, 10 * S);
        }
      }
    }
    // vrtinci
    lv.P.forEach(function (p) {
      if (p.y - p.r > yTop || p.y + p.r < yBot) return;
      var px = sx(p.x), py = sy(p.y), pr = p.r * S;
      var rg = ctx.createRadialGradient(px, py, 0, px, py, pr);
      rg.addColorStop(0, "rgba(8, 47, 73, 0.75)"); rg.addColorStop(1, "rgba(8, 47, 73, 0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"; ctx.lineWidth = 2.5 * S;
      for (var k = 0; k < 4; k++) {
        var rot = -G.time * 2.2 * p.str + k * Math.PI / 2;
        ctx.beginPath(); ctx.arc(px, py, pr * (0.3 + k * 0.17), rot, rot + 2.2); ctx.stroke();
      }
    });
    ctx.restore();

    // start in cilj
    band(lv, 40, "#a16207", "#854d0e");
    finishLine(lv);

    // bodice ob bregovih
    (lv.spikes || []).forEach(function (sp) {
      var a0 = Math.max(sp[0], Math.floor(yBot / 28) * 28), a1 = Math.min(sp[1], yTop);
      for (var yy = a0; yy <= a1; yy += 28) {
        var rs = river(lv, yy);
        [-1, 1].forEach(function (side) {
          var bx = rs.cx + side * rs.hw;
          ctx.fillStyle = "#cbd5e1"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.5 * S;
          ctx.beginPath();
          ctx.moveTo(sx(bx + side * 6), sy(yy - 11)); ctx.lineTo(sx(bx - side * 20), sy(yy)); ctx.lineTo(sx(bx + side * 6), sy(yy + 11));
          ctx.closePath(); ctx.fill(); ctx.stroke();
        });
      }
    });

    // zapornice
    lv.Gt.forEach(function (g) {
      if (g.y - 40 > yTop || g.y + 40 < yBot) return;
      var gy = sy(g.y), th = GATE_R * S;
      [[g.cx - g.hw - 20, g.cx - g.gap], [g.cx + g.gap, g.cx + g.hw + 20]].forEach(function (seg) {
        if (seg[1] <= seg[0]) return;
        var x0 = sx(seg[0]), x1 = sx(seg[1]);
        ctx.fillStyle = "#dc2626"; roundRect(x0, gy - th, x1 - x0, th * 2, 4 * S); ctx.fill();
        ctx.save(); roundRect(x0, gy - th, x1 - x0, th * 2, 4 * S); ctx.clip();
        ctx.fillStyle = "#f8fafc";
        for (var xs = x0 - 40 * S; xs < x1; xs += 28 * S) {
          ctx.beginPath(); ctx.moveTo(xs, gy + th); ctx.lineTo(xs + 12 * S, gy - th); ctx.lineTo(xs + 24 * S, gy - th); ctx.lineTo(xs + 12 * S, gy + th); ctx.fill();
        }
        ctx.restore();
      });
      [g.cx - g.hw - 24, g.cx + g.hw + 24].forEach(function (px) {
        ctx.fillStyle = "#374151"; ctx.beginPath(); ctx.arc(sx(px), gy, 16 * S, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = g.open > 0.5 ? "#22c55e" : "#ef4444";
        ctx.beginPath(); ctx.arc(sx(px), gy, 8 * S, 0, Math.PI * 2); ctx.fill();
      });
    });

    // slapovi: penasta stopnica čez reko, žleb med zelenima kolema
    lv.Fa.forEach(function (f) {
      if (f.y - 60 > yTop || f.y + 120 < yBot) return;
      var rv = river(lv, f.y), x0 = sx(rv.cx - rv.hw), x1 = sx(rv.cx + rv.hw), fy = sy(f.y);
      var gr = ctx.createLinearGradient(0, fy, 0, fy - 90 * S); // dol po toku = navzgor na zaslonu
      gr.addColorStop(0, "rgba(255,255,255,0.85)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gr; ctx.fillRect(x0, fy - 90 * S, x1 - x0, 90 * S);
      ctx.fillStyle = "rgba(15, 23, 42, 0.35)"; ctx.fillRect(x0, fy, x1 - x0, 6 * S);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3 * S;
      ctx.beginPath();
      for (var xx = x0; xx <= x1; xx += 14 * S) ctx.lineTo(xx, fy - (Math.sin(xx * 0.3 + G.time * 8) + 1) * 4 * S);
      ctx.stroke();
      var c0 = sx(f.cx - f.hw), c1 = sx(f.cx + f.hw);
      ctx.fillStyle = "rgba(134, 239, 172, 0.35)"; ctx.fillRect(c0, fy, c1 - c0, 50 * S);
      [c0, c1].forEach(function (px) {
        ctx.fillStyle = "#166534"; ctx.beginPath(); ctx.arc(px, fy + 4 * S, 9 * S, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#4ade80"; ctx.beginPath(); ctx.arc(px, fy + 4 * S, 5 * S, 0, Math.PI * 2); ctx.fill();
      });
    });
    // povodni možje: temen vrtinec + zelena glava, roke se dvignejo, ko je splav blizu
    lv.Pm.forEach(function (pm) {
      if (pm.y - PM_WARN > yTop || pm.y + PM_WARN < yBot) return;
      var px = sx(pm.x), py = sy(pm.y), gr2 = (PM_GRAB + 30) * S;
      var near = 0;
      G.rafts.forEach(function (r) { if (!r.out) near = Math.max(near, 1 - Math.min(1, (Math.hypot(r.x - pm.x, r.y - pm.y) - RC - PM_GRAB) / PM_WARN)); });
      var rg = ctx.createRadialGradient(px, py, 0, px, py, gr2);
      rg.addColorStop(0, "rgba(5, 46, 22, 0.85)"); rg.addColorStop(1, "rgba(5, 46, 22, 0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, gr2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(187, 247, 208, " + (0.25 + near * 0.5) + ")"; ctx.lineWidth = 2 * S;
      for (var k = 0; k < 3; k++) {
        var rot = G.time * 1.6 + k * 2.1;
        ctx.beginPath(); ctx.arc(px, py, gr2 * (0.4 + k * 0.2), rot, rot + 1.8); ctx.stroke();
      }
      var hr = 15 * S;
      ctx.fillStyle = "#65a30d"; ctx.beginPath(); ctx.arc(px, py, hr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#365314";
      for (var h = -2; h <= 2; h++) { ctx.beginPath(); ctx.ellipse(px + h * 5 * S, py - hr * 0.8, 3 * S, 7 * S, h * 0.3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "#fef9c3";
      ctx.beginPath(); ctx.arc(px - 5 * S, py - 2 * S, 3.5 * S, 0, Math.PI * 2); ctx.arc(px + 5 * S, py - 2 * S, 3.5 * S, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(px - 5 * S, py - 2 * S, 1.6 * S, 0, Math.PI * 2); ctx.arc(px + 5 * S, py - 2 * S, 1.6 * S, 0, Math.PI * 2); ctx.fill();
      if (near > 0.05) {
        // roke iz vode proti reki
        [-1, 1].forEach(function (s2) {
          var ax = px - pm.side * (18 + 20 * near) * S, ay = py + s2 * (14 + 8 * near) * S;
          ctx.strokeStyle = "#4d7c0f"; ctx.lineWidth = 5 * S; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(px - pm.side * 8 * S, py + s2 * 8 * S); ctx.lineTo(ax, ay); ctx.stroke();
          ctx.fillStyle = "#65a30d"; ctx.beginPath(); ctx.arc(ax, ay, 5 * S, 0, Math.PI * 2); ctx.fill();
        });
        ctx.lineCap = "butt";
      }
    });
    // otočki (rokavi): pesek + trava + grmički
    lv.Is.forEach(function (is) {
      if (is.y0 - 60 > yTop || is.y1 + 60 < yBot) return;
      [[is.r + 10, "#d6b77a"], [is.r, "#4d7c0f"]].forEach(function (lay) {
        ctx.strokeStyle = lay[1]; ctx.lineWidth = lay[0] * 2 * S; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(sx(is.x0), sy(is.y0)); ctx.lineTo(sx(is.x1), sy(is.y1)); ctx.stroke();
      });
      ctx.lineCap = "butt";
      for (var iy = is.y0 + 30; iy < is.y1; iy += 70) {
        var ik = (iy - is.y0) / (is.y1 - is.y0), ixx = is.x0 + (is.x1 - is.x0) * ik;
        ctx.fillStyle = "#2f6f2d"; ctx.beginPath(); ctx.arc(sx(ixx + (hash(iy) - 0.5) * 16), sy(iy), 14 * S, 0, Math.PI * 2); ctx.fill();
      }
    });
    // trampolin in stena (skok nazaj gor)
    lv.Jp.forEach(function (jp) {
      if (jp.ty - 60 > yTop || jp.y + 60 < yBot) return;
      var rv = river(lv, jp.y), x0 = sx(rv.cx - rv.hw - 10), x1 = sx(rv.cx + rv.hw + 10), wy = sy(jp.y);
      ctx.fillStyle = "#57534e"; ctx.fillRect(x0, wy - 14 * S, x1 - x0, 14 * S);
      ctx.fillStyle = "#a8a29e";
      for (var bx2 = x0; bx2 < x1; bx2 += 30 * S) ctx.fillRect(bx2 + 2 * S, wy - 12 * S, 26 * S, 5 * S);
      var t0 = sx(jp.cx - jp.hw), t1 = sx(jp.cx + jp.hw), ty2 = sy(jp.ty);
      ctx.fillStyle = "#1d4ed8"; roundRect(t0, ty2 - 16 * S, t1 - t0, 32 * S, 8 * S); ctx.fill();
      ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 5 * S; roundRect(t0, ty2 - 16 * S, t1 - t0, 32 * S, 8 * S); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3 * S;
      for (var c = 0; c < 3; c++) { var cy2 = ty2 + 6 * S - c * 9 * S; chevron((t0 + t1) / 2, cy2, -Math.PI / 2, 10 * S); }
    });
    // mine: temna krogla z bodicami in utripajočo lučko; po eksploziji obroč
    lv.Mi.forEach(function (m) {
      if (m.y - 80 > yTop || m.y + 80 < yBot) return;
      var mx = sx(m.x), my = sy(m.y), since = G.time - m.boomAt;
      if (!mineOn(m)) {
        if (since < 0.6) {
          ctx.strokeStyle = "rgba(251, 146, 60, " + (1 - since / 0.6) + ")"; ctx.lineWidth = 6 * S;
          ctx.beginPath(); ctx.arc(mx, my, (20 + since * 260) * S, 0, Math.PI * 2); ctx.stroke();
        }
        return;
      }
      var bob = Math.sin(G.time * 2 + m.y) * 2 * S;
      ctx.strokeStyle = "#27272a"; ctx.lineWidth = 4 * S;
      for (var sp2 = 0; sp2 < 8; sp2++) {
        var aa = sp2 * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(mx, my + bob); ctx.lineTo(mx + Math.cos(aa) * (MINE_R + 7) * S, my + bob + Math.sin(aa) * (MINE_R + 7) * S); ctx.stroke();
      }
      ctx.fillStyle = "#3f3f46"; ctx.beginPath(); ctx.arc(mx, my + bob, MINE_R * S, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = (G.time * 2 + m.x * 0.01) % 1 < 0.5 ? "#ef4444" : "#7f1d1d";
      ctx.beginPath(); ctx.arc(mx, my + bob, 5 * S, 0, Math.PI * 2); ctx.fill();
    });
    // gejzirji: mehurčki → izbruh
    lv.Gy.forEach(function (g) {
      if (g.y - 120 > yTop || g.y + 120 < yBot) return;
      var st = geyserState(g), gx = sx(g.x), gy2 = sy(g.y);
      ctx.fillStyle = "rgba(120, 53, 15, 0.35)"; ctx.beginPath(); ctx.arc(gx, gy2, GEY_R * S, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(254, 215, 170, 0.7)"; ctx.lineWidth = 3 * S;
      ctx.beginPath(); ctx.arc(gx, gy2, GEY_R * 0.6 * S, 0, Math.PI * 2); ctx.stroke();
      for (var bq = 0; bq < 6; bq++) {
        var ba = bq * 1.05 + G.time * 2, br2 = (GEY_R * 0.6) * ((G.time * 1.5 + bq * 0.37) % 1);
        ctx.fillStyle = "rgba(255,255,255," + (0.25 + st.warn * 0.6) + ")";
        ctx.beginPath(); ctx.arc(gx + Math.cos(ba) * br2 * S, gy2 + Math.sin(ba) * br2 * S, (3 + st.warn * 5) * S, 0, Math.PI * 2); ctx.fill();
      }
      if (st.up) {
        ctx.fillStyle = "rgba(248, 250, 252, " + (0.5 + st.up * 0.4) + ")";
        ctx.beginPath(); ctx.arc(gx, gy2, GEY_R * (1 + (1 - st.up) * 0.6) * S, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(gx, gy2, GEY_R * 0.6 * S, 0, Math.PI * 2); ctx.fill();
      }
    });
    // portali: vhod (vrtinec v barvi), izhod (tanek obroč)
    lv.Po.forEach(function (po) {
      var col = po.fwd ? "59, 130, 246" : "249, 115, 22";
      if (po.ay - 80 < yTop && po.ay + 80 > yBot) {
        var px2 = sx(po.ax), py2 = sy(po.ay);
        ctx.fillStyle = "rgba(" + col + ", 0.35)"; ctx.beginPath(); ctx.arc(px2, py2, (PORT_R + 10) * S, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 5 * S;
        for (var pk = 0; pk < 3; pk++) {
          ctx.strokeStyle = "rgba(" + col + ", " + (0.9 - pk * 0.25) + ")";
          ctx.beginPath(); ctx.arc(px2, py2, (PORT_R - pk * 12) * S, G.time * 3 + pk, G.time * 3 + pk + 4.2); ctx.stroke();
        }
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3 * S; chevron(px2, py2, po.fwd ? -Math.PI / 2 : Math.PI / 2, 10 * S);
      }
      if (po.by - 80 < yTop && po.by + 80 > yBot) {
        ctx.strokeStyle = "rgba(" + col + ", 0.6)"; ctx.lineWidth = 3 * S; ctx.setLineDash([8 * S, 6 * S]);
        ctx.beginPath(); ctx.arc(sx(po.bx), sy(po.by), PORT_R * 0.8 * S, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    });
    // rešilni obroči
    lv.Bu.forEach(function (b) {
      if (b.taken || b.y - 40 > yTop || b.y + 40 < yBot) return;
      var bx = sx(b.x), by = sy(b.y) + Math.sin(G.time * 3 + b.y) * 2 * S, br = BUOY_R * S;
      ctx.lineWidth = 7 * S;
      for (var q = 0; q < 8; q++) {
        ctx.strokeStyle = q % 2 ? "#f8fafc" : "#dc2626";
        ctx.beginPath(); ctx.arc(bx, by, br, q * Math.PI / 4 + G.time * 0.5, (q + 1) * Math.PI / 4 + G.time * 0.5); ctx.stroke();
      }
    });

    // skale
    lv.R.forEach(function (o) {
      if (o.y - o.r > yTop || o.y + o.r < yBot) return;
      var ox = sx(o.x), oy = sy(o.y), or = o.r * S;
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath(); ctx.arc(ox, oy, or * (1.15 + 0.05 * Math.sin(G.time * 3 + o.y)), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#6b7280"; ctx.beginPath(); ctx.arc(ox, oy, or, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9ca3af"; ctx.beginPath(); ctx.arc(ox - or * 0.25, oy - or * 0.25, or * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#d1d5db"; ctx.beginPath(); ctx.arc(ox - or * 0.38, oy - or * 0.4, or * 0.2, 0, Math.PI * 2); ctx.fill();
    });
    // vrtiljaki (leseni križi)
    lv.Sp.forEach(function (sp) {
      if (sp.y - sp.len > yTop || sp.y + sp.len < yBot) return;
      var cx = sx(sp.x), cy = sy(sp.y), a0 = spinAng(sp);
      ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 2 * S;
      ctx.setLineDash([8 * S, 8 * S]); ctx.beginPath(); ctx.arc(cx, cy, sp.len * S, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineCap = "round";
      for (var k = 0; k < sp.angs.length; k++) {
        var a = a0 + sp.angs[k];
        var ex = cx + Math.cos(a) * sp.len * S, ey = cy - Math.sin(a) * sp.len * S; // y na zaslonu je obrnjen
        ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = SPIN_ARM * 2 * S;
        ctx.beginPath(); ctx.moveTo(cx + 4 * S, cy + 5 * S); ctx.lineTo(ex + 4 * S, ey + 5 * S); ctx.stroke();
        ctx.strokeStyle = "#92562a";
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = "#c08048"; ctx.lineWidth = 4 * S;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(ex, ey, SPIN_ARM * S, 0, Math.PI * 2); ctx.fill();
      }
      ctx.lineCap = "butt";
      ctx.fillStyle = "#5b3a1f"; ctx.beginPath(); ctx.arc(cx, cy, SPIN_HUB * S, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#a16207"; ctx.beginPath(); ctx.arc(cx, cy, SPIN_HUB * 0.5 * S, 0, Math.PI * 2); ctx.fill();
    });
    // hlodi
    lv.L.forEach(function (l) {
      if (l.y - 30 > yTop || l.y + 30 < yBot) return;
      var lx = logX(l), x0 = sx(lx - l.half), x1 = sx(lx + l.half), ly = sy(l.y), th = LOG_R * S;
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      roundRect(x0 - 6 * S, ly - th - 5 * S, x1 - x0 + 12 * S, (th + 5 * S) * 2, th + 5 * S); ctx.fill();
      ctx.fillStyle = "#7c4a1e"; roundRect(x0, ly - th, x1 - x0, th * 2, th); ctx.fill();
      ctx.strokeStyle = "#5b3410"; ctx.lineWidth = 2 * S;
      ctx.beginPath(); ctx.moveTo(x0 + th, ly - th * 0.3); ctx.lineTo(x1 - th, ly - th * 0.3); ctx.stroke();
      ctx.fillStyle = "#c08a52";
      ctx.beginPath(); ctx.ellipse(x1 - th * 0.4, ly, th * 0.45, th * 0.85, 0, 0, Math.PI * 2); ctx.fill();
    });

    // mlinska kolesa: od zgoraj je kolo črta čez reko; lopate pod vodo so ovira
    lv.Wh.forEach(function (wh) {
      if (wh.y - 40 > yTop || wh.y + 40 < yBot) return;
      var wy = sy(wh.y);
      ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(sx(wh.rcx - wh.rhw - 30), wy - 4 * S, (wh.rhw * 2 + 60) * S, 8 * S);
      [wh.rcx - wh.rhw - 30, wh.rcx + wh.rhw + 30].forEach(function (px) {
        ctx.fillStyle = "#57534e"; ctx.fillRect(sx(px) - 12 * S, wy - 12 * S, 24 * S, 24 * S);
      });
      ctx.strokeStyle = "rgba(146, 86, 42, 0.35)"; ctx.lineWidth = 6 * S;
      ctx.beginPath(); ctx.moveTo(sx(wh.x - wh.R), wy); ctx.lineTo(sx(wh.x + wh.R), wy); ctx.stroke();
      wheelSegs(wh).forEach(function (sg) {
        ctx.fillStyle = "rgba(255,255,255,0.5)"; roundRect(sx(sg.x1) - 8 * S, wy - (WHEEL_T + 7) * S, (sg.x2 - sg.x1 + 16) * S, (WHEEL_T + 7) * 2 * S, 10 * S); ctx.fill();
        ctx.fillStyle = "#92562a"; roundRect(sx(sg.x1), wy - WHEEL_T * S, (sg.x2 - sg.x1) * S, WHEEL_T * 2 * S, 5 * S); ctx.fill();
      });
      ctx.fillStyle = "#78350f"; ctx.beginPath(); ctx.arc(sx(wh.x), wy, 14 * S, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(sx(wh.x), wy, 6 * S, 0, Math.PI * 2); ctx.fill();
    });
    // topovi na bregu in krogle
    lv.Cn.forEach(function (c) {
      if (c.y - 60 > yTop || c.y + 60 < yBot) return;
      var bl = cannonBall(c), cy3 = sy(c.y), cx3 = sx(c.x0);
      if (bl.warn > 0) {
        ctx.strokeStyle = "rgba(239, 68, 68, " + (bl.warn * 0.45) + ")"; ctx.lineWidth = (RC * 2) * S * 0.25; ctx.setLineDash([14 * S, 10 * S]);
        ctx.beginPath(); ctx.moveTo(sx(c.rcx - c.rhw), cy3); ctx.lineTo(sx(c.rcx + c.rhw), cy3); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.save(); ctx.translate(cx3, cy3); ctx.scale(-c.side, 1);
      ctx.fillStyle = "#3f3f46"; roundRect(0, -9 * S, 46 * S, 18 * S, 6 * S); ctx.fill();
      ctx.fillStyle = bl.warn > 0 ? "rgb(" + Math.round(80 + 175 * bl.warn) + ", 60, 40)" : "#18181b";
      ctx.beginPath(); ctx.arc(46 * S, 0, 10 * S, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#78350f"; ctx.beginPath(); ctx.arc(4 * S, 0, 18 * S, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (bl.on) {
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.arc(sx(bl.x) + 5 * S, cy3 + 5 * S, BALL_R * S, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#18181b"; ctx.beginPath(); ctx.arc(sx(bl.x), cy3, BALL_R * S, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(sx(bl.x) - 5 * S, cy3 - 5 * S, 5 * S, 0, Math.PI * 2); ctx.fill();
      }
    });
    // krokodili
    lv.Cr.forEach(function (c) {
      if (c.y - 60 > yTop || c.y + 60 < yBot) return;
      var cx0 = sx(crocX(c)), cy0 = sy(c.y), dir = crocV(c) >= 0 ? 1 : -1, L = CROC_HALF * S, R0 = CROC_R * S;
      var jaw = (Math.sin(G.time * 5 + c.ph) + 1) * 0.5;
      ctx.save(); ctx.translate(cx0, cy0); ctx.scale(dir, 1);
      ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.ellipse(0, 0, L + 10 * S, R0 + 6 * S, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3f6212";
      ctx.beginPath(); ctx.moveTo(-L - 22 * S, 0); ctx.lineTo(-L * 0.6, -R0 * 0.7); ctx.lineTo(-L * 0.6, R0 * 0.7); ctx.closePath(); ctx.fill(); // rep
      ctx.beginPath(); ctx.ellipse(-L * 0.1, 0, L * 0.75, R0, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4d7c0f";
      ctx.beginPath(); ctx.moveTo(L * 0.5, -R0 * 0.6); ctx.lineTo(L + 4 * S, -R0 * (0.3 + 0.25 * jaw)); ctx.lineTo(L + 4 * S, R0 * (0.3 + 0.25 * jaw)); ctx.lineTo(L * 0.5, R0 * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fef9c3";
      ctx.beginPath(); ctx.arc(L * 0.45, -R0 * 0.55, 4 * S, 0, Math.PI * 2); ctx.arc(L * 0.45, R0 * 0.55, 4 * S, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath(); ctx.arc(L * 0.47, -R0 * 0.55, 1.8 * S, 0, Math.PI * 2); ctx.arc(L * 0.47, R0 * 0.55, 1.8 * S, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#365314";
      for (var sc = -2; sc <= 2; sc++) { ctx.beginPath(); ctx.arc(sc * 12 * S - 6 * S, 0, 3 * S, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });

    drawParts(false);
    G.rafts.forEach(function (r) {
      if (r.out) return;
      if (r.air) {
        // skok: senca na vodi, splav večji (višje)
        var lift = airLift(r), ax0 = sx(r.x), ay0 = sy(r.y), sc2 = 1 + lift / 260;
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(ax0 + lift * 0.25 * S, ay0 + lift * 0.15 * S, RAFT * S, RAFT * 0.8 * S, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(ax0, ay0); ctx.scale(sc2, sc2); ctx.translate(-ax0, -ay0);
        drawRaft(r);
        ctx.restore();
        return;
      }
      if (r.sink) {
        // povodni mož: splav se vrti, manjša in potone
        var sk = r.sink.t, kx = sx(r.x), ky = sy(r.y);
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - sk);
        ctx.translate(kx, ky); ctx.scale(1 - sk * 0.6, 1 - sk * 0.6); ctx.translate(-kx, -ky);
        drawRaft(r);
        ctx.restore();
      } else if (r.fall) {
        // padec: splav se manjša in bledi (pada v globino)
        var fk = r.fall.t, fx0 = sx(r.x), fy0 = sy(r.y);
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - fk);
        ctx.translate(fx0, fy0); ctx.scale(1 - fk * 0.7, 1 - fk * 0.7); ctx.translate(-fx0, -fy0);
        drawRaft(r);
        ctx.restore();
      } else drawRaft(r);
    });
    drawParts(true);
  }

  /* =================== 3D izris (prdoplav3d.js + Three.js, naloži se ob izbiri) =================== */
  var R3 = null, view = "2d", loading3d = false;
  var cv3 = $("cv3");

  window.PRDOPLAV = {
    G: G, LEVELS: LEVELS, ANIMALS: ANIMALS, TEAMS: TEAMS, RAFT: RAFT, CURRENT: CURRENT,
    river: river, logX: logX, elev: elev, openSide: openSide, spinAng: spinAng, SPIN_HUB: SPIN_HUB, SPIN_ARM: SPIN_ARM, slopeAt: slopeAt, GATE_R: GATE_R, LOG_R: LOG_R,
    prepareLevel: prepareLevel, widthFor: widthFor, RC: RC,
    crocX: crocX, crocV: crocV, CROC_HALF: CROC_HALF, CROC_R: CROC_R, PM_GRAB: PM_GRAB, PM_WARN: PM_WARN, BUOY_R: BUOY_R,
    wheelAng: wheelAng, airLift: airLift, WHEEL_T: WHEEL_T,
    cannonBall: cannonBall, geyserState: geyserState, mineOn: mineOn, MINE_R: MINE_R, BALL_R: BALL_R, GEY_R: GEY_R, PORT_R: PORT_R
  };

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function setView(v) {
    try { localStorage.setItem("prdoplav-view", v); } catch (e) {}
    renderViewPick(v);
    if (v === "2d") { view = "2d"; cv3.hidden = true; return; }
    if (R3) { view = "3d"; cv3.hidden = false; R3.resize(W, H); return; }
    if (loading3d) return;
    loading3d = true;
    $("viewNote").hidden = false; $("viewNote").textContent = "Nalagam 3D …";
    var p = window.THREE ? Promise.resolve() : loadScript("https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js");
    p.then(function () { return window.PRDO3D ? null : loadScript("prdoplav3d.js"); })
      .then(function () {
        R3 = window.PRDO3D.create(cv3, window.PRDOPLAV);
        if (!R3) throw new Error("webgl");
        R3.resize(W, H);
        view = "3d"; cv3.hidden = false;
        $("viewNote").hidden = true;
      })
      .catch(function () {
        view = "2d"; cv3.hidden = true;
        renderViewPick("2d");
        $("viewNote").hidden = false;
        $("viewNote").textContent = "3D na tej napravi ne deluje, igra teče v 2D.";
      })
      .then(function () { loading3d = false; });
  }

  function renderViewPick(v) {
    Array.prototype.forEach.call($("viewPick").children, function (b) {
      b.classList.toggle("on", b.getAttribute("data-v") === v);
    });
  }

  function draw3d(dt) {
    var lv = LEVELS[G.lv];
    R3.render(dt);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // imena nad živalmi
    G.players.forEach(function (p) {
      var rf = raftOf(p);
      if (rf.out || rf.fall) return;
      var a = rf.ang + p.phi;
      var pt = R3.project(rf.x + Math.cos(a) * RAFT, rf.y + Math.sin(a) * RAFT, R3.animalTop(p));
      if (pt.front) nameTag(p, pt.x, pt.y, G.race ? 0.95 : 1.15);
    });
    // zaostajanje: rdeče odštevanje nad splavom
    G.rafts.forEach(function (r) {
      if (!(r.edgeT > 0) || r.done || r.out) return;
      var pt = R3.project(r.x, r.y, 130);
      if (!pt.front) return;
      var es = 30, left = Math.max(0, Math.ceil(EDGE_OUT - r.edgeT));
      ctx.font = "900 " + es + "px Outfit, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(220, 38, 38, 0.9)"; ctx.beginPath(); ctx.arc(pt.x, pt.y, es * 0.95, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(String(left), pt.x, pt.y + 1);
    });
    drawHud(lv);
  }

  function chevron(x, y, a, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-s * 0.6, -s); ctx.lineTo(s * 0.5, 0); ctx.lineTo(-s * 0.6, s); ctx.stroke();
    ctx.restore();
  }

  function riverPath(lv, y0, y1, step, extra) {
    ctx.beginPath();
    var y, rv;
    for (y = y0; y <= y1; y += step) { rv = river(lv, y); ctx.lineTo(sx(rv.cx - rv.hw - extra), sy(y)); }
    for (y = y1; y >= y0; y -= step) { rv = river(lv, y); ctx.lineTo(sx(rv.cx + rv.hw + extra), sy(y)); }
    ctx.closePath();
  }

  function band(lv, y, c1, c2) {
    var rv = river(lv, y);
    var x0 = sx(rv.cx - rv.hw - 30), x1 = sx(rv.cx + rv.hw + 30), yy = sy(y);
    if (yy < -60 || yy > H + 60) return;
    ctx.fillStyle = c1; ctx.fillRect(x0, yy - 10 * S, x1 - x0, 40 * S);
    ctx.strokeStyle = c2; ctx.lineWidth = 2 * S;
    for (var x = x0; x < x1; x += 22 * S) { ctx.beginPath(); ctx.moveTo(x, yy - 10 * S); ctx.lineTo(x, yy + 30 * S); ctx.stroke(); }
  }

  function finishLine(lv) {
    var y = lv.len, rv = river(lv, y), yy = sy(y);
    if (yy < -120 || yy > H + 60) return;
    var x0 = sx(rv.cx - rv.hw), x1 = sx(rv.cx + rv.hw), c = 18 * S;
    for (var i = 0, x = x0; x < x1; x += c, i++) {
      for (var j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? "#111827" : "#f8fafc";
        ctx.fillRect(x, yy - c * (j + 1), Math.min(c, x1 - x), c);
      }
    }
    [x0 - 14 * S, x1 + 14 * S].forEach(function (fx, k) {
      ctx.fillStyle = "#78350f"; ctx.fillRect(fx - 2 * S, yy - 70 * S, 4 * S, 72 * S);
      ctx.fillStyle = k ? "#ef4444" : "#facc15";
      ctx.beginPath(); ctx.moveTo(fx, yy - 70 * S); ctx.lineTo(fx + (k ? -1 : 1) * 30 * S, yy - 60 * S); ctx.lineTo(fx, yy - 50 * S); ctx.fill();
    });
    ctx.fillStyle = "#fff"; ctx.font = "900 " + Math.round(26 * S) + "px Outfit, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("CILJ", (x0 + x1) / 2, yy - 2 * c - 6 * S);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawParts(top) {
    G.parts.forEach(function (p) {
      if (!!p.grow !== top) return;
      var k = p.life / p.max;
      ctx.globalAlpha = (1 - k) * (p.grow ? 0.75 : 0.9);
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), p.r * S * (p.grow ? 1 + k * 1.6 : 1), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawRaft(r) {
    var rx = sx(r.x), ry = sy(r.y), R = RAFT * S;
    var crew = G.players.filter(function (p) { return G.rafts[p.raft] === r; });
    if (r.inv > 0 && r.inv < 100 && Math.floor(r.inv * 10) % 2 === 0) ctx.globalAlpha = 0.55;
    else if (r.fall) ctx.globalAlpha = Math.max(0, 1 - r.fall.t);
    // val okoli (pri tekmi v barvi splava)
    ctx.strokeStyle = G.race ? TEAMS[r.team].c : "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = (G.race ? 6 : 3) * S;
    ctx.beginPath(); ctx.arc(rx, ry, R * 1.18 + Math.sin(G.time * 4) * 2 * S, 0, Math.PI * 2); ctx.stroke();

    ctx.save(); ctx.translate(rx, ry); ctx.rotate(-r.ang);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)"; ctx.beginPath(); ctx.arc(4 * S, 6 * S, R * 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
    var pw = R * 2 / 6;
    for (var i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? "#b7791f" : "#a16207";
      ctx.fillRect(-R + i * pw, -R, pw, R * 2);
      ctx.strokeStyle = "#78350f"; ctx.lineWidth = 2 * S;
      ctx.strokeRect(-R + i * pw, -R, pw, R * 2);
    }
    ctx.restore();
    ctx.strokeStyle = "#e2c48a"; ctx.lineWidth = 5 * S;
    ctx.beginPath(); ctx.arc(0, 0, R - 3 * S, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#78350f"; ctx.lineWidth = 2 * S;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = r.fall ? Math.max(0, 1 - r.fall.t) : 1;
    if (G.race) raceFlag(r, rx, ry, R);

    crew.forEach(function (p) {
      var a = r.ang + p.phi;
      var ax = rx + Math.cos(a) * R, ay = ry - Math.sin(a) * R;
      var face = Math.atan2(Math.sin(a), -Math.cos(a)); // proti sredini (zaslon)
      drawAnimal(p, ax, ay, face);
    });
    crew.forEach(function (p) {
      var a = r.ang + p.phi;
      var tx = rx + Math.cos(a) * (R + 40 * S), ty = ry - Math.sin(a) * (R + 40 * S);
      nameTag(p, tx, ty);
    });
    ctx.globalAlpha = 1;
  }

  // zastavica ekipe na sredini splava (+ mesto, ko je v cilju)
  function raceFlag(r, rx, ry, R) {
    var c = TEAMS[r.team].c;
    ctx.strokeStyle = "#78350f"; ctx.lineWidth = 3 * S;
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry - R * 0.95); ctx.stroke();
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(rx, ry - R * 0.95); ctx.lineTo(rx + R * 0.6, ry - R * 0.78); ctx.lineTo(rx, ry - R * 0.6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.5 * S; ctx.stroke();
    if (r.edgeT > 0 && !r.done && !r.out) {
      var es = Math.round(26 * S), left = Math.max(0, Math.ceil(EDGE_OUT - r.edgeT));
      ctx.font = "900 " + es + "px Outfit, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(220, 38, 38, 0.85)"; ctx.beginPath(); ctx.arc(rx, ry, es * 0.95, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(String(left), rx, ry + 1);
    }
    if (r.done) {
      var fs = Math.round(22 * S);
      ctx.font = "900 " + fs + "px Outfit, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.beginPath(); ctx.arc(rx, ry, fs * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(r.place + ".", rx, ry + 1);
    }
  }

  function drawAnimal(p, x, y, face) {
    var u = 13 * S, an = ANIMALS[p.slot].key;
    var swell = 1 + 0.18 * p.charge + (p.holding ? Math.sin(G.time * 40) * 0.03 * p.charge : 0);
    ctx.save(); ctx.translate(x, y); ctx.rotate(face);

    // obroč igralca
    ctx.strokeStyle = ANIMALS[p.slot].ring; ctx.lineWidth = 3.5 * S;
    ctx.beginPath(); ctx.arc(0, 0, u * 1.7, 0, Math.PI * 2); ctx.stroke();

    // nabira se oblak
    if (p.charge > 0.05) {
      ctx.fillStyle = "rgba(190, 242, 100, " + (0.25 + 0.45 * p.charge) + ")";
      ctx.beginPath(); ctx.arc(-u * 1.5, 0, u * (0.5 + 1.1 * p.charge), 0, Math.PI * 2); ctx.fill();
    }
    ctx.scale(1, swell);
    var body, head, dark = "#1f2937";
    if (an === "krava") { body = "#f8fafc"; head = "#f8fafc"; }
    else if (an === "pujs") { body = "#f9a8d4"; head = "#f9a8d4"; }
    else if (an === "koza") { body = "#d6b98c"; head = "#e7d3ad"; }
    else { body = "#fde047"; head = "#fde047"; }
    if (ANIMALS[p.slot].body) { body = ANIMALS[p.slot].body; head = ANIMALS[p.slot].head || body; }

    // rep / perje
    ctx.strokeStyle = an === "pujs" ? "#ec4899" : dark; ctx.lineWidth = 2 * S;
    if (an === "pujs") { ctx.beginPath(); ctx.arc(-u * 1.45, 0, u * 0.3, 0, Math.PI * 1.6); ctx.stroke(); }
    else if (an !== "raca") { ctx.beginPath(); ctx.moveTo(-u * 1.2, 0); ctx.lineTo(-u * 1.7, u * 0.2); ctx.stroke(); }

    ctx.fillStyle = body; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.5 * S;
    ctx.beginPath(); ctx.ellipse(0, 0, u * 1.25, u * (an === "raca" ? 1.05 : 0.9), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (an === "krava") {
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(-u * 0.4, -u * 0.35, u * 0.35, u * 0.25, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(u * 0.3, u * 0.4, u * 0.3, u * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
    }
    if (an === "raca") {
      ctx.fillStyle = "#facc15";
      ctx.beginPath(); ctx.ellipse(-u * 0.2, -u * 0.75, u * 0.7, u * 0.28, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-u * 0.2, u * 0.75, u * 0.7, u * 0.28, -0.2, 0, Math.PI * 2); ctx.fill();
    }
    // glava
    var hx = u * (an === "raca" ? 1.0 : 1.25), hr = u * (an === "raca" ? 0.62 : 0.68);
    if (an === "pujs" || an === "krava" || an === "koza") {
      ctx.fillStyle = an === "pujs" ? "#f472b6" : head;
      [-1, 1].forEach(function (s) {
        ctx.beginPath(); ctx.ellipse(hx - u * 0.25, s * u * 0.6, u * 0.32, u * 0.16, s * 0.6, 0, Math.PI * 2); ctx.fill();
      });
    }
    if (an === "krava" || an === "koza") {
      ctx.strokeStyle = an === "koza" ? "#6b4f2a" : "#e7d3ad"; ctx.lineWidth = 2.5 * S;
      [-1, 1].forEach(function (s) {
        ctx.beginPath(); ctx.moveTo(hx - u * 0.1, s * u * 0.3);
        ctx.quadraticCurveTo(hx - u * 0.6, s * u * 0.55, hx - u * 0.75, s * u * 0.25); ctx.stroke();
      });
    }
    ctx.fillStyle = head; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.5 * S;
    ctx.beginPath(); ctx.arc(hx, 0, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (an === "krava") { ctx.fillStyle = "#fbcfe8"; ctx.beginPath(); ctx.ellipse(hx + hr * 0.7, 0, hr * 0.45, hr * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    if (an === "pujs") {
      ctx.fillStyle = "#f472b6"; ctx.beginPath(); ctx.ellipse(hx + hr * 0.75, 0, hr * 0.35, hr * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9d174d";
      ctx.beginPath(); ctx.arc(hx + hr * 0.8, -hr * 0.18, hr * 0.09, 0, Math.PI * 2); ctx.arc(hx + hr * 0.8, hr * 0.18, hr * 0.09, 0, Math.PI * 2); ctx.fill();
    }
    if (an === "koza") { ctx.fillStyle = "#8b6b3e"; ctx.beginPath(); ctx.ellipse(hx + hr * 0.9, 0, hr * 0.3, hr * 0.18, 0, 0, Math.PI * 2); ctx.fill(); }
    if (an === "raca") {
      ctx.fillStyle = "#fb923c";
      ctx.beginPath(); ctx.ellipse(hx + hr * 0.95, 0, hr * 0.55, hr * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(hx + hr * 0.3, -hr * 0.42, hr * 0.13, 0, Math.PI * 2); ctx.arc(hx + hr * 0.3, hr * 0.42, hr * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function nameTag(p, x, y, big) {
    var label = G.mode === "tel" ? (p.name || "").split(/\s+/)[0] : "P" + (p.slot + 1);
    var fs = Math.max(12, Math.round(14 * S * (big || 1)));
    ctx.font = "800 " + fs + "px Outfit, sans-serif";
    var w = ctx.measureText(label).width + fs;
    var tm = G.race ? TEAMS[raftOf(p).team] : null; // pri tekmi oznaka v barvi splava
    ctx.fillStyle = tm ? tm.c : ANIMALS[p.slot].ring;
    roundRect(x - w / 2, y - fs * 0.8, w, fs * 1.6, fs * 0.8); ctx.fill();
    ctx.fillStyle = tm && tm.name === "Beli" ? "#0f172a" : "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, x, y + 1);
  }

  function heart(x, y, s, full) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.65, x, y + s * 0.85, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.85, x + s * 0.5, y + s * 0.65, x + s * 0.5, y + s * 0.35);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35);
    ctx.fillStyle = full ? "#ef4444" : "rgba(0,0,0,0.35)"; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawHud(lv) {
    if (G.phase === "menu" || G.phase === "lobby") return;
    var u = Math.max(0.8, Math.min(W, H * 1.5) / 1000);
    var pad = 16 * u;
    // proga + napredek
    ctx.fillStyle = "rgba(0,0,0,0.4)"; roundRect(pad, pad, 260 * u, 58 * u, 14 * u); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = "800 " + Math.round(18 * u) + "px Outfit, sans-serif";
    ctx.fillText(lv.name, pad + 14 * u, pad + 9 * u);
    ctx.fillStyle = "rgba(255,255,255,0.2)"; roundRect(pad + 14 * u, pad + 36 * u, 232 * u, 10 * u, 5 * u); ctx.fill();
    if (G.race) {
      // napredek vseh splavov: pikice v barvah ekip
      G.rafts.forEach(function (r) {
        var pr = Math.max(0, Math.min(1, r.y / lv.len));
        ctx.globalAlpha = r.out ? 0.35 : 1;
        ctx.fillStyle = TEAMS[r.team].c;
        ctx.beginPath(); ctx.arc(pad + 14 * u + 232 * u * pr, pad + 41 * u, 8 * u, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      });
      ctx.globalAlpha = 1;
    } else {
      var prog = Math.max(0, Math.min(1, G.raft.y / lv.len));
      ctx.fillStyle = "#a3e635"; roundRect(pad + 14 * u, pad + 36 * u, Math.max(10 * u, 232 * u * prog), 10 * u, 5 * u); ctx.fill();
    }
    // čas
    ctx.textAlign = "center"; ctx.font = "900 " + Math.round(38 * u) + "px Outfit, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillText(fmt(G.t), W / 2 + 2, pad + 2);
    ctx.fillStyle = "#fff"; ctx.fillText(fmt(G.t), W / 2, pad);
    if (G.refill > 0 && !G.fartInf && G.phase === "play") {
      var rleft = Math.max(0, Math.ceil(G.refill - G.refillT));
      ctx.font = "800 " + Math.round(16 * u) + "px Outfit, sans-serif";
      ctx.fillStyle = G.refillFlash > 0 ? "#bef264" : "rgba(255,255,255,0.85)";
      ctx.fillText(G.refillFlash > 0 ? "Prdci napolnjeni!" : "Polnjenje prdcev čez " + rleft + " s", W / 2, pad + 46 * u);
    }
    if (G.race && G.raceEndT !== null && G.phase === "play") {
      ctx.font = "900 " + Math.round(20 * u) + "px Outfit, sans-serif";
      ctx.fillStyle = "#fde047";
      ctx.fillText("Še " + Math.max(0, Math.ceil(G.raceEndT)) + " s do konca tekme", W / 2, pad + (G.refill > 0 && !G.fartInf ? 70 : 48) * u);
    }
    if (G.race) { drawRaceCards(u, pad); drawCountdown(u); return; }
    // življenja
    for (var i = 0; i < MAXL; i++) heart(W - 130 - 20 * u - i * 40 * u, pad + 12 * u, 30 * u, i < G.raft.lives); // levo od gumbov v kotu

    // igralci spodaj
    var n = G.players.length, cw = Math.min(240 * u, (W - pad * 2 - (n - 1) * 10) / n), ch = 54 * u;
    var x0 = W / 2 - (n * cw + (n - 1) * 10) / 2, y0 = H - ch - pad;
    G.players.forEach(function (p, k) {
      var x = x0 + k * (cw + 10);
      ctx.fillStyle = "rgba(0,0,0,0.45)"; roundRect(x, y0, cw, ch, 14 * u); ctx.fill();
      ctx.fillStyle = ANIMALS[p.slot].ring; roundRect(x, y0, 8 * u, ch, 4 * u); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.font = "800 " + Math.round(16 * u) + "px Outfit, sans-serif";
      var nm = G.mode === "tel" ? p.name : "P" + (p.slot + 1) + " · " + KEYS[p.slot].label.join(" ");
      var lt = p.left === Infinity ? "" : String(Math.max(0, p.left));
      if (lt) {
        ctx.textAlign = "right";
        ctx.fillStyle = p.left <= 0 ? "#f87171" : p.left <= 5 ? "#facc15" : "#d9f99d";
        ctx.fillText(p.left <= 0 ? "brez prdcev" : lt + " prdcev", x + cw - 12 * u, y0 + 8 * u);
        ctx.textAlign = "left"; ctx.fillStyle = "#fff";
      }
      ctx.fillText(fit(nm, cw - (lt ? 110 : 30) * u), x + 18 * u, y0 + 8 * u);
      ctx.fillStyle = "rgba(255,255,255,0.18)"; roundRect(x + 18 * u, y0 + 32 * u, cw - 32 * u, 12 * u, 6 * u); ctx.fill();
      ctx.fillStyle = p.gas > 0.5 ? "#a3e635" : p.gas > 0.2 ? "#facc15" : "#f97316";
      roundRect(x + 18 * u, y0 + 32 * u, Math.max(12 * u, (cw - 32 * u) * p.gas), 12 * u, 6 * u); ctx.fill();
      if (G.mode === "tel" && performance.now() - p.lastIn > 2500) {
        ctx.fillStyle = "#fca5a5"; ctx.textAlign = "right"; ctx.font = "700 " + Math.round(12 * u) + "px Outfit, sans-serif";
        ctx.fillText("ni povezan", x + cw - 10 * u, y0 + 10 * u);
      }
    });

    drawCountdown(u);
  }

  function drawCountdown(u) {
    if (G.phase === "count") {
      var c = Math.ceil(G.count - 0.2);
      var txt = c > 0 ? String(c) : "PRDI!";
      var k2 = G.count % 1;
      ctx.font = "900 " + Math.round((120 + 40 * k2) * u) + "px Outfit, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillText(txt, W / 2 + 4, H * 0.42 + 6);
      ctx.fillStyle = "#d9f99d"; ctx.fillText(txt, W / 2, H * 0.42);
    }
  }

  // Tekma: kartica za vsak splav (barva, mesto/stanje, življenja, igralci s preostalimi prdci).
  function drawRaceCards(u, pad) {
    var rank = ranking(), n = rank.length, gap = 10;
    var cw = Math.min(300 * u, (W - pad * 2 - (n - 1) * gap) / n), ch = 76 * u;
    var x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, y0 = H - ch - pad;
    rank.forEach(function (r, k) {
      var x = x0 + k * (cw + gap), tm = TEAMS[r.team];
      ctx.globalAlpha = r.out ? 0.55 : 1;
      ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(x, y0, cw, ch, 14 * u); ctx.fill();
      ctx.fillStyle = tm.c; roundRect(x, y0, 10 * u, ch, 5 * u); ctx.fill();
      ctx.textBaseline = "top"; ctx.textAlign = "left";
      ctx.font = "900 " + Math.round(17 * u) + "px Outfit, sans-serif";
      ctx.fillStyle = tm.c;
      ctx.fillText((k + 1) + ". " + tm.name, x + 20 * u, y0 + 8 * u);
      ctx.textAlign = "right"; ctx.font = "800 " + Math.round(14 * u) + "px Outfit, sans-serif";
      ctx.fillStyle = r.done ? "#bef264" : r.out || r.edgeT > 0 ? "#fca5a5" : "#fff";
      ctx.fillText(r.done ? "v cilju " + fmt(r.t) : r.out ? whyText(r.why) : (r.edgeT > 0 ? "zaostaja! " + Math.max(0, Math.ceil(EDGE_OUT - r.edgeT)) + " s" : Math.round(Math.min(1, r.y / LEVELS[G.lv].len) * 100) + " %"), x + cw - 10 * u, y0 + 10 * u);
      for (var i = 0; i < MAXL; i++) heart(x + 28 * u + i * 20 * u, y0 + 32 * u, 15 * u, i < r.lives);
      var crew = G.players.filter(function (p) { return G.rafts[p.raft] === r; }).map(function (p) {
        var nm = G.mode === "tel" ? (p.name || "").split(/\s+/)[0] : "P" + (p.slot + 1);
        return p.left === Infinity ? nm : nm + " " + Math.max(0, p.left);
      }).join(" · ");
      ctx.textAlign = "left"; ctx.font = "700 " + Math.round(13 * u) + "px Outfit, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(fit(crew, cw - 30 * u), x + 20 * u, y0 + 54 * u);
      ctx.globalAlpha = 1;
    });
  }

  function fit(s, w) {
    if (ctx.measureText(s).width <= w) return s;
    while (s.length > 1 && ctx.measureText(s + "…").width > w) s = s.slice(0, -1);
    return s + "…";
  }

  /* =================== Zanka =================== */
  var last = performance.now();
  function loop(now) {
    // simulacija v korakih po največ 1/60 s — tudi ob padcu sličic teče v pravem času
    var total = Math.min(0.25, (now - last) / 1000);
    var frameDt = total;
    last = now;
    while (total > 0) {
      var dt = Math.min(1 / 60, total);
      total -= dt;
      step(dt);
    }
    if (R3 && view === "3d") draw3d(frameDt); else draw();
    if (now - lastPush > 250) pushState(false);
    requestAnimationFrame(loop);
  }

  function step(dt) {
    G.time += dt;
    updateGates(dt);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);

    if (G.phase === "count") {
      G.count -= dt;
      updatePlayers(dt, false);
      if (G.count <= 0) { G.phase = "play"; sound.fart(0.6); pushState(true); }
    } else if (G.phase === "play") {
      G.t += dt;
      updatePlayers(dt, true);
      physics(dt);
      if (G.race && G.phase === "play") {
        if (G.raceEndT !== null) G.raceEndT -= dt;
        pullForward(dt);
        checkRaceEnd();
      }
    } else if (G.phase === "menu" || G.phase === "lobby") {
      // splavi na začetku lenobno plujejo
      G.rafts.forEach(function (r, i) {
        r.y = 140 + Math.sin(G.time * 0.5 + i) * 20;
        r.ang = i * 0.9 + Math.sin(G.time * 0.3 + i) * 0.4;
      });
    } else {
      physics(dt);
    }
    updateParts(dt);
    updateCamera(dt);
  }

  /* Kamera: sredina splavov, ki še tekmujejo. Pri tekmi se oddalji, da vidi vse splave
     in celo širino reke (do ZOOM_MIN). */
  var ZOOM_MIN = 0.34, CAM_MARGIN = 520;
  function racing() {
    var a = G.rafts.filter(function (r) { return !r.out && !r.done; });
    if (!a.length) a = G.rafts.filter(function (r) { return !r.out; });
    return a.length ? a : G.rafts;
  }
  function updateCamera(dt) {
    var lv = LEVELS[G.lv], act = racing();
    var minY = Infinity, maxY = -Infinity, sumX = 0;
    act.forEach(function (r) { minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.y); sumX += r.x; });
    var cy = (minY + maxY) / 2, rv = river(lv, cy);
    var tx = (sumX / act.length) * 0.7 + rv.cx * 0.3, ty = cy + 40;
    var zt = 1;
    if (G.race) {
      var zy = (H / S) / (maxY - minY + CAM_MARGIN), zx = (W / S) / (2 * rv.hw + 260);
      zt = Math.max(ZOOM_MIN, Math.min(1, zy, zx));
      tx = tx * 0.4 + rv.cx * 0.6; // široka reka: bolj na sredino
    }
    var ck = 1 - Math.exp(-3 * dt);
    G.cam.x += (tx - G.cam.x) * ck; G.cam.y += (ty - G.cam.y) * ck;
    G.zoom += (zt - G.zoom) * (1 - Math.exp(-2 * dt));
    G.camSpan += ((G.race ? maxY - minY : 0) - G.camSpan) * ck; // za 3D kamero
  }

  /* Spodnji rob zaslona: kamera se oddalji do ZOOM_MIN; kdor zaostane do roba, ga rob
     potiska naprej (splav normalno vozi naprej, le nazaj ne more). Kdor je na robu
     EDGE_OUT sekund skupaj, izpade. Spust z roba odšteva nazaj. */
  var EDGE_OUT = 5;
  function edgeY() {
    var act = G.rafts.filter(function (r) { return !r.out && !r.done; });
    if (act.length < 2) return -Infinity;
    var lead = Math.max.apply(null, act.map(function (r) { return r.y; }));
    return lead - ((H / (S * ZOOM_MIN)) - CAM_MARGIN);
  }
  function pullForward(dt) {
    var ey = edgeY();
    G.rafts.forEach(function (r) {
      if (r.out || r.done || r.fall) { r.edgeT = 0; return; }
      if (r.y <= ey + RC) {
        if (r.y < ey) { r.y = ey; if (r.vy < 0) r.vy = 0; }
        var before = r.edgeT || 0;
        r.edgeT = before + dt;
        if (Math.ceil(EDGE_OUT - before) !== Math.ceil(EDGE_OUT - r.edgeT)) { sound.bonk(0.3); pushState(true); }
        if (r.edgeT >= EDGE_OUT) { r.edgeT = 0; raftLost(r, "edge"); }
      } else if (r.edgeT) {
        r.edgeT = Math.max(0, r.edgeT - dt * 2);
      }
    });
  }

  /* =================== Telefoni (soba) =================== */
  var sb = NET.client();
  var me = null; // prijavljeni uporabnik gostitelja
  var lastPush = 0;

  // gost brez Bitneverse računa (pridružil se je prek QR kode): presence ključ "g-…"
  function isGuest(uid) { return /^g-/.test(uid); }

  var tel = {
    room: null, code: null, ready: false,
    lobby: null, lobbyReady: false, lastN: -1, openedAt: 0, hostName: "",
    lobbyKey: "h-" + NET.newCode() + Date.now().toString(36),
    waitList: [],  // telefoni z odprtim Prdoplavom, ki še niso v sobi (čakalna vrsta)
    players: [],   // { uid, name, slot, waiting }

    open: function () {
      if (!sb || !me) return;
      tel.close();
      tel.code = NET.newCode();
      tel.openedAt = Date.now();
      tel.players = [];
      tel.ready = false;
      var room = NET.channel(sb, tel.code, "host");
      tel.room = room;
      room
        .on("presence", { event: "sync" }, tel.onPresence)
        .on("broadcast", { event: NET.EV.IN }, function (m) { tel.onInput(m.payload || {}); })
        .on("broadcast", { event: NET.EV.CMD }, function (m) { tel.onCmd(m.payload || {}); })
        .subscribe(function (status) {
          if (status === "SUBSCRIBED") {
            tel.ready = true;
            room.track({ host: true, at: Date.now() });
            $("lobbyMsg").textContent = "Soba je odprta. Čakam na igralce …";
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            $("lobbyMsg").textContent = "Povezave s strežnikom ni. Preveri internet in odpri sobo znova.";
          }
        });
      tel.showQr();
      // oglas v skupnem kanalu — čakajoči telefoni se ob tem povežejo sami
      tel.watch();
      tel.announce();
      tel.render();
    },

    // QR koda za goste: kamera telefona odpre kontroler s kodo sobe, gost vpiše ime.
    showQr: function () {
      var code = tel.code, box = $("qrBox");
      $("qrCode").textContent = code;
      box.innerHTML = "";
      var lib = window.qrcode ? Promise.resolve() : loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js");
      Promise.all([lib, NET.joinBase()]).then(function (res) {
        if (tel.code !== code) return;
        var url = NET.controllerUrl(code, res[1]) + "&gost=1";
        var qr = window.qrcode(0, "M");
        qr.addData(url); qr.make();
        box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
        box.title = url;
      }).catch(function () { box.textContent = "QR kode ni bilo mogoče naložiti."; });
    },

    // Skupni kanal poslušamo že od zagona: vidimo, kdo s telefonom čaka v vrsti.
    watch: function () {
      if (tel.lobby || !sb || !me) return;
      var lobby = NET.lobbyChannel(sb, tel.lobbyKey);
      tel.lobby = lobby;
      lobby
        .on("presence", { event: "sync" }, tel.onLobby)
        .subscribe(function (status) {
          if (status === "SUBSCRIBED") { tel.lobbyReady = true; tel.lastN = -1; tel.announce(); }
        });
    },

    onLobby: function () {
      if (!tel.lobby) return;
      var st = tel.lobby.presenceState(), list = [];
      Object.keys(st).forEach(function (k) {
        var m = st[k] && st[k][0];
        if (m && m.wait) list.push(m.name || "Igralec");
      });
      tel.waitList = list;
      var el = $("telWait");
      if (!el) return;
      el.hidden = !list.length;
      $("qTitle").textContent = list.length === 1 ? "1 igralec čaka s telefonom"
        : list.length === 2 ? "2 igralca čakata s telefonom"
        : list.length + (list.length < 5 ? " igralci čakajo" : " igralcev čaka") + " s telefonom";
      var box = $("qList");
      box.innerHTML = "";
      list.forEach(function (nm) {
        var chip = document.createElement("span"), av = document.createElement("i");
        av.textContent = (nm.trim()[0] || "?").toUpperCase();
        chip.appendChild(av);
        chip.appendChild(document.createTextNode(nm));
        box.appendChild(chip);
      });
    },

    announce: function () {
      if (!tel.lobby || !tel.lobbyReady || !tel.room || !tel.code) return;
      var n = tel.players.filter(function (p) { return !p.waiting; }).length;
      if (tel.lastN === n) return;
      tel.lastN = n;
      tel.lobby.track({ code: tel.code, name: tel.hostName || "Soba", n: n, at: tel.openedAt });
    },

    close: function () {
      if (tel.room) { try { sb.removeChannel(tel.room); } catch (e) {} }
      // skupni kanal ostane (čakalna vrsta), samo soba se umakne iz oglasa
      if (tel.lobby && tel.lobbyReady && tel.lastN !== -1) { try { tel.lobby.untrack(); } catch (e) {} }
      tel.syncInputs({});
      tel.seq = {};
      tel.room = null; tel.lastN = -1;
      tel.ready = false; tel.players = [];
    },

    // prosta žival na splavu (ekipi) t
    freeSlot: function (t) {
      t = t || 0;
      for (var s = 0; s < (G.teamSize ? 4 : G.crew); s++) {
        if (!tel.players.some(function (p) { return !p.waiting && (p.team || 0) === t && p.slot === s; })) return s;
      }
      return -1;
    },
    teamCount: function (t, except) {
      return tel.players.filter(function (p) { return !p.waiting && p !== except && (p.team || 0) === t; }).length;
    },
    // ekipa za novega igralca: najprej se zapolni prvi splav, nato naslednji (največ 4 splavi)
    pickTeam: function () {
      if (!G.teamSize) return tel.teamCount(0) < G.crew ? 0 : -1;
      for (var t = 0; t < G.raftMax; t++) if (tel.teamCount(t) < G.teamSize) return t;
      return -1;
    },
    canChangeTeams: function () { return G.phase === "lobby" || G.phase === "end" || G.phase === "over" || G.phase === "menu"; },
    // prestavi igralca na splav t (če je tam prostor)
    moveTo: function (p, t) {
      if (!G.teamSize || !tel.canChangeTeams() || !(t >= 0 && t < G.raftMax) || p.waiting) return false;
      if ((p.team || 0) === t || tel.teamCount(t, p) >= G.teamSize) return false;
      p.team = t; p.slot = -1;
      p.slot = tel.freeSlot(t);
      tel.changed();
      return true;
    },
    moveNext: function (p) {
      for (var k = 1; k <= G.raftMax; k++) if (tel.moveTo(p, ((p.team || 0) + k) % G.raftMax)) return;
    },
    // vsi znova po vrsti (ob spremembi velikosti ekipe ali »Premešaj«)
    reassign: function (shuffle) {
      var act = tel.players.filter(function (p) { return !p.waiting; });
      act.sort(function (a, b) { return ((a.team || 0) - (b.team || 0)) || (a.slot - b.slot); });
      if (shuffle) for (var i = act.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = act[i]; act[i] = act[j]; act[j] = x; }
      // čakajoči za njimi (npr. ko se ekipe povečajo, je spet prostor)
      if (tel.canChangeTeams()) act = act.concat(tel.players.filter(function (p) { return p.waiting; }));
      act.forEach(function (p) { p.waiting = true; p.slot = -1; });
      act.forEach(function (p) {
        var t = tel.pickTeam(), sl = t >= 0 ? tel.freeSlot(t) : -1;
        if (t >= 0 && sl >= 0) { p.team = t; p.slot = sl; p.waiting = false; }
      });
      tel.changed();
    },
    // po spremembi ekip: predogled splavov v sobi + telefoni
    changed: function () {
      if (G.mode === "tel" && G.phase === "lobby") {
        G.players = makePlayers(tel.players.filter(function (p) { return !p.waiting; }));
        resetRaft(LEVELS[G.lv]);
      }
      tel.render();
      pushState(true);
    },

    onPresence: function () {
      if (!tel.room) return;
      var state = tel.room.presenceState();
      var online = {};
      Object.keys(state).forEach(function (k) {
        if (k === "host") return;
        var meta = (state[k] && state[k][0]) || {};
        online[k] = String(meta.name || "Igralec").slice(0, 24);
      });
      var canChange = G.phase === "lobby" || G.phase === "end" || G.phase === "over" || G.phase === "menu";
      // odšli
      tel.players = tel.players.filter(function (p) { return online[p.uid] || !(canChange || p.waiting); });
      // novi
      tel.syncInputs(online);
      Object.keys(online).forEach(function (uid) {
        var p = tel.players.find(function (x) { return x.uid === uid; });
        if (p) { p.name = online[uid]; p.guest = isGuest(uid); return; }
        var team = tel.pickTeam(), slot = team >= 0 ? tel.freeSlot(team) : -1;
        if (slot >= 0 && canChange) tel.players.push({ uid: uid, name: online[uid], guest: isGuest(uid), slot: slot, team: team, waiting: false });
        else tel.players.push({ uid: uid, name: online[uid], guest: isGuest(uid), slot: -1, team: 0, waiting: true });
      });
      tel.changed();
    },

    admitWaiting: function () {
      tel.onPresence(); // odstrani tiste, ki so med vožnjo odšli
      tel.players.forEach(function (p) {
        if (!p.waiting) return;
        var t = tel.pickTeam(), s = t >= 0 ? tel.freeSlot(t) : -1;
        if (s >= 0) { p.team = t; p.slot = s; p.waiting = false; }
      });
      tel.render();
    },

    inCh: {},   // uid → lasten kanal vnosov tega telefona
    seq: {},    // uid → { s, n } zadnji sprejeti vnos (zakasnela starejša sporočila zavržemo)
    // Za vsakega igralca v sobi poslušamo njegov kanal vnosov; odšle odstranimo.
    syncInputs: function (online) {
      Object.keys(online).forEach(function (uid) {
        if (tel.inCh[uid] || !tel.code) return;
        var ch = NET.inputChannel(sb, tel.code, uid);
        ch.on("broadcast", { event: NET.EV.IN }, function (m) { tel.onInput(m.payload || {}); }).subscribe();
        tel.inCh[uid] = ch;
      });
      Object.keys(tel.inCh).forEach(function (uid) {
        if (online[uid]) return;
        try { sb.removeChannel(tel.inCh[uid]); } catch (e) {}
        delete tel.inCh[uid];
      });
    },
    onInput: function (m) {
      var p = G.players.find(function (x) { return x.uid === m.u; });
      if (!p) return;
      if (m.s != null) {
        var last = tel.seq[m.u];
        if (last && last.s === m.s && m.n <= last.n) return; // starejše od že sprejetega
        tel.seq[m.u] = { s: m.s, n: m.n };
      }
      p.inp.l = !!m.l; p.inp.r = !!m.r; p.inp.f = !!m.f;
      p.lastIn = performance.now();
    },

    onCmd: function (m) {
      if (!tel.players.some(function (p) { return p.uid === m.u; })) return;
      if (m.a === "team") {
        var who = tel.players.find(function (p) { return p.uid === m.u; });
        if (who) tel.moveTo(who, Number(m.t));
        return;
      }
      if (m.a === "start" && G.phase === "lobby") beginTel();
      else if (m.a === "next" && G.phase === "end") next();
      else if (m.a === "retry" && (G.phase === "end" || G.phase === "over")) startLevel(G.lv);
    },

    render: function () {
      var ul = $("roster");
      ul.innerHTML = "";
      var active = tel.players.filter(function (p) { return !p.waiting; }).sort(function (a, b) { return a.slot - b.slot; });
      ul.classList.toggle("teams", !!G.teamSize);
      if (G.teamSize) { tel.renderTeams(ul, active); return; }
      for (var s = 0; s < G.crew; s++) {
        var p = active.find(function (x) { return x.slot === s; });
        var li = document.createElement("li");
        var dot = document.createElement("i");
        dot.style.background = ANIMALS[s].ring;
        li.appendChild(dot);
        if (p) {
          li.appendChild(document.createTextNode(p.name));
          var sp = document.createElement("span"); sp.textContent = ANIMALS[s].name + (p.guest ? " · gost" : "");
          li.appendChild(sp);
        } else {
          li.className = "empty";
          li.appendChild(document.createTextNode(ANIMALS[s].name + " · prosto"));
        }
        ul.appendChild(li);
      }
      var waiting = tel.players.filter(function (p) { return p.waiting; }).length;
      if (waiting && tel.ready) $("lobbyMsg").textContent = waiting + " čaka na prosto mesto.";
      $("btnStart").disabled = !active.length;
      tel.announce();
    },

    // Tekma: stolpec za vsak splav; klik na ime prestavi igralca na naslednji splav.
    renderTeams: function (ul, active) {
      var used = 0;
      for (var t = 0; t < 4; t++) if (active.some(function (p) { return (p.team || 0) === t; })) used = t + 1;
      var show = G.raftMax < 4 ? G.raftMax : Math.min(4, Math.max(2, used + (used < 4 ? 1 : 0)));
      for (var k = 0; k < show; k++) {
        var tm = TEAMS[k], li = document.createElement("li");
        li.className = "team"; li.style.setProperty("--tc", tm.c);
        var h = document.createElement("div"); h.className = "th";
        var dot = document.createElement("i"); dot.style.background = tm.c; h.appendChild(dot);
        var on = active.filter(function (p) { return (p.team || 0) === k; });
        h.appendChild(document.createTextNode(tm.name));
        var cnt = document.createElement("span"); cnt.textContent = on.length + " / " + G.teamSize; h.appendChild(cnt);
        li.appendChild(h);
        on.forEach(function (p) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "pl"; b.title = "Prestavi na drug splav";
          b.textContent = p.name + (p.guest ? " (gost)" : "");
          b.addEventListener("click", function () { tel.moveNext(p); });
          li.appendChild(b);
        });
        if (!on.length) { var e = document.createElement("div"); e.className = "pe"; e.textContent = "prazno"; li.appendChild(e); }
        ul.appendChild(li);
      }
      var tools = document.createElement("li");
      tools.className = "team-tools";
      var mix = document.createElement("button");
      mix.type = "button"; mix.className = "ghost"; mix.textContent = "Premešaj ekipe";
      mix.disabled = active.length < 2;
      mix.addEventListener("click", function () { tel.reassign(true); });
      tools.appendChild(mix);
      var teamsUsed = [];
      active.forEach(function (p) { if (teamsUsed.indexOf(p.team || 0) < 0) teamsUsed.push(p.team || 0); });
      var note = document.createElement("span");
      note.textContent = teamsUsed.length > 1 ? teamsUsed.length + " splavi tekmujejo · klik na ime prestavi igralca" : "Za tekmo potrebuješ igralce na vsaj dveh splavih.";
      tools.appendChild(note);
      ul.appendChild(tools);
      var waiting = tel.players.filter(function (p) { return p.waiting; }).length;
      if (waiting && tel.ready) $("lobbyMsg").textContent = waiting + " čaka na prosto mesto.";
      $("btnStart").disabled = !active.length;
      tel.announce();
    }
  };

  function beginTel() {
    if (!tel.players.some(function (p) { return !p.waiting; })) return;
    startLevel(G.lv);
  }

  var pushTimer = 0;
  function pushState(force) {
    if (!tel.room || !tel.ready) return;
    var now = performance.now();
    if (!force && now - lastPush < 250) return;
    if (now - lastPush < 100) {
      // več nujnih naenkrat (npr. prdci več igralcev): eno sporočilo malo kasneje
      if (!pushTimer) pushTimer = setTimeout(function () { pushTimer = 0; pushState(true); }, 100 - (now - lastPush));
      return;
    }
    lastPush = now;
    var byUid = {};
    G.players.forEach(function (p) { if (p.uid) byUid[p.uid] = p; });
    var lv = LEVELS[G.lv];
    tel.room.send({
      type: "broadcast", event: NET.EV.ST,
      payload: {
        ph: G.phase, lv: G.lv, lvName: lv.name, lives: G.raft ? G.raft.lives : MAXL, maxLives: MAXL,
        ts: G.teamSize,
        teams: G.teamSize ? [0, 1, 2, 3].slice(0, G.raftMax).map(function (t) { return { n: tel.teamCount(t) }; }) : null,
        rafts: G.race ? G.rafts.map(function (r) { return { t: r.team, lives: r.lives, done: r.done, out: r.out, place: r.place, why: r.why || "", e: r.edgeT > 0 ? Math.max(0, Math.ceil(EDGE_OUT - r.edgeT)) : 0 }; }) : null,
        rank: G.race && (G.phase === "end" || G.phase === "over") ? ranking().map(function (r) { return r.team; }) : null,
        farts: fartLimit(lv) === Infinity ? null : fartLimit(lv),
        rf: G.refill > 0 && !G.fartInf ? G.refill : 0,
        wt: G.water,
        sp: G.spin,
        rfIn: G.refill > 0 && !G.fartInf ? Math.max(0, Math.ceil(G.refill - G.refillT)) : null,
        next: G.phase === "end" && G.lv < LEVELS.length - 1,
        p: tel.players.map(function (t) {
          var gp = byUid[t.uid];
          return { u: t.uid, s: t.slot, t: t.team || 0, w: !!t.waiting, g: gp ? Math.round(gp.gas * 100) / 100 : 1, c: gp ? Math.round(gp.charge * 100) / 100 : 0,
            f: gp && gp.left !== Infinity ? Math.max(0, gp.left) : null };
        })
      }
    });
  }

  function sendBuzz(p) {
    if (p.uid && tel.room && tel.ready) pushState(true);
  }

  /* =================== Meni in gumbi =================== */
  function showOnly(id) {
    ["menu", "lobby", "end"].forEach(function (k) { $(k).hidden = k !== id; });
  }

  function renderKeys() {
    var box = $("keysList");
    box.innerHTML = "";
    for (var i = 0; i < G.n; i++) {
      var d = document.createElement("div");
      var dot = document.createElement("i"); dot.style.background = ANIMALS[i].ring;
      d.appendChild(dot);
      d.appendChild(document.createTextNode("P" + (i + 1) + " " + ANIMALS[i].name + ": "));
      KEYS[i].label.forEach(function (l, j) {
        var k = document.createElement("kbd"); k.textContent = l; d.appendChild(k);
        if (j < 2) d.appendChild(document.createTextNode(" "));
      });
      d.appendChild(document.createTextNode(" (levo · desno · prdec)"));
      if (G.teamSize) {
        var tm = TEAMS[Math.min(G.raftMax - 1, Math.floor(i / G.teamSize))], tag = document.createElement("b");
        tag.className = "team-tag"; tag.textContent = tm.name; tag.style.background = tm.c;
        d.appendChild(tag);
      }
      box.appendChild(d);
    }
  }

  /* Nastavitev prdcev: število na igralca (natančno po 1, ali neomejeno) in
     polnjenje — vsakih N sekund vsi spet dobijo izbrano število. */
  var FART_MAX = 999, REFILL_MAX = 600;
  function setFartCount(v) {
    var lv = LEVELS[G.lv];
    v = Math.max(1, Math.min(FART_MAX, Math.round(v) || 1));
    G.fartDelta = v - lv.farts;
  }
  function setRefill(v) { G.refill = Math.max(1, Math.min(REFILL_MAX, Math.round(v) || 1)); }

  // − [vnos] +  ; držanje gumba šteje hitreje
  function stepper(row, value, min, max, onSet, disabled, label, step) {
    step = step || 1;
    var inp = document.createElement("input");
    function mk(txt, d, aria) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = txt; b.setAttribute("aria-label", aria);
      b.disabled = disabled || (d < 0 ? value <= min : value >= max);
      var t1 = null, t2 = null, moved = false;
      function bump() {
        var v = Math.max(min, Math.min(max, (parseInt(inp.value, 10) || value) + d));
        inp.value = v; onSet(v); moved = true;
        pushState(false);
      }
      function stop() {
        clearTimeout(t1); clearInterval(t2); t1 = t2 = null;
        if (moved) { moved = false; renderFarts(); pushState(true); }
      }
      b.addEventListener("pointerdown", function (e) {
        if (b.disabled) return;
        e.preventDefault();
        bump();
        t1 = setTimeout(function () { t2 = setInterval(bump, 70); }, 380);
      });
      b.addEventListener("pointerup", stop);
      b.addEventListener("pointerleave", stop);
      b.addEventListener("pointercancel", stop);
      // tipkovnica (Enter / preslednica na gumbu)
      b.addEventListener("click", function (e) { if (e.detail === 0) { bump(); stop(); } });
      return b;
    }
    row.appendChild(mk("−", -step, "Manj"));
    inp.type = "number"; inp.inputMode = "numeric"; inp.min = min; inp.max = max; inp.step = step;
    inp.value = disabled ? "" : value; inp.placeholder = disabled ? "∞" : "";
    inp.disabled = !!disabled; inp.className = "num"; inp.setAttribute("aria-label", label);
    inp.addEventListener("change", function () { onSet(parseInt(inp.value, 10)); renderFarts(); pushState(true); });
    inp.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") inp.blur(); });
    row.appendChild(inp);
    row.appendChild(mk("+", step, "Več"));
  }

  function renderFarts() {
    var lv = LEVELS[G.lv], lim = fartLimit(lv);
    ["fartsMenu", "fartsLobby"].forEach(function (id) {
      var box = $(id);
      if (!box) return;
      var focused = document.activeElement && box.contains(document.activeElement);
      if (focused && document.activeElement.tagName === "INPUT") return; // ne prekinjaj vpisovanja
      box.innerHTML = "";
      function row() { var r = document.createElement("div"); r.className = "farts-row"; box.appendChild(r); return r; }
      function btn(r, txt, label, fn, on) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = txt; b.setAttribute("aria-label", label);
        if (on) b.className = "on";
        b.addEventListener("click", function () { fn(); renderFarts(); pushState(true); });
        r.appendChild(b);
        return b;
      }
      function note(r, t) { var n = document.createElement("span"); n.className = "note"; n.textContent = t; r.appendChild(n); }

      // število prdcev
      var r1 = row();
      stepper(r1, lim, 1, FART_MAX, setFartCount, G.fartInf, "Število prdcev na igralca");
      btn(r1, "∞", "Neomejeno prdcev", function () { G.fartInf = !G.fartInf; }, G.fartInf);
      if (G.fartDelta !== 0 && !G.fartInf) btn(r1, "privzeto", "Privzeto za to progo", function () { G.fartDelta = 0; }).classList.add("reset");
      note(r1, G.fartInf ? "brez omejitve" : "privzeto za to progo: " + lv.farts);

      // hitrost vode
      var rw = row();
      var wl = document.createElement("span"); wl.className = "lab"; wl.textContent = "Hitrost vode"; rw.appendChild(wl);
      stepper(rw, G.water, 0, 300, function (v) { G.water = Math.max(0, Math.min(300, Math.round(v) || 0)); }, false, "Hitrost vode v odstotkih", 10);
      note(rw, "%");
      if (G.water !== 100) btn(rw, "običajno", "Običajna hitrost vode", function () { G.water = 100; }).classList.add("reset");
      note(rw, G.water === 0 ? "mirna voda" : G.water < 100 ? "počasnejši tok" : G.water > 100 ? "hitrejši tok" : "");

      // vrtenje splava okoli svoje osi
      var rs = row();
      var sl = document.createElement("span"); sl.className = "lab"; sl.textContent = "Vrtenje splava"; rs.appendChild(sl);
      stepper(rs, G.spin, 0, 500, function (v) { G.spin = Math.max(0, Math.min(500, Math.round(v) || 0)); }, false, "Hitrost vrtenja splava v odstotkih", 25);
      note(rs, "%");
      if (G.spin !== 100) btn(rs, "običajno", "Običajno vrtenje splava", function () { G.spin = 100; }).classList.add("reset");
      note(rs, G.spin === 0 ? "se ne vrti sam" : G.spin < 100 ? "počasneje" : G.spin > 100 ? "hitreje" : "");

      // polnjenje
      if (G.fartInf) return;
      var r2 = row();
      var lab = document.createElement("span"); lab.className = "lab"; lab.textContent = "Polnjenje"; r2.appendChild(lab);
      btn(r2, G.refill > 0 ? "vklopljeno" : "izklopljeno", "Polnjenje prdcev", function () {
        G.refill = G.refill > 0 ? 0 : (G.lastRefill || 30);
      }, G.refill > 0).classList.add("reset");
      if (G.refill > 0) {
        note(r2, "vsakih");
        stepper(r2, G.refill, 1, REFILL_MAX, function (v) { setRefill(v); G.lastRefill = G.refill; }, false, "Sekunde do polnjenja");
        note(r2, "s se vsem napolni na " + lim);
      } else {
        note(r2, "prdci se med vožnjo ne obnavljajo");
      }
    });
  }

  /* Splavi: vsi na enem splavu ali tekma ekip (1–4 igralci na splav). */
  function setTeamSize(v, max, crew) {
    G.teamSize = v;
    G.raftMax = max || 4;
    G.crew = v ? 4 : crew || 4;
    if (G.mode === "tel") tel.reassign(false);
    else if (G.phase === "menu") { G.players = makePlayers(kbList()); resetRaft(LEVELS[G.lv]); }
    renderKeys();
    renderRace();
    pushState(true);
  }
  function renderRace() {
    ["raceMenu", "raceLobby"].forEach(function (id) {
      var box = $(id);
      if (!box) return;
      box.innerHTML = "";
      var r1 = document.createElement("div"); r1.className = "farts-row"; box.appendChild(r1);
      function btn(txt, label, v, max, row) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = txt; b.setAttribute("aria-label", label);
        if (G.teamSize === v && G.raftMax === (max || 4) && (v || G.crew === (max || 4))) b.className = "on";
        b.addEventListener("click", function () { setTeamSize(v, v ? max : 4, v ? 4 : max); });
        (row || r1).appendChild(b);
        return b;
      }
      btn("En splav", "Vsi na enem splavu, do 4", 0).classList.add("reset");
      // en splav za 6 ali 8 (samo s telefoni)
      [6, 8].forEach(function (c) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = "En splav po " + c; b.setAttribute("aria-label", "En splav, do " + c + " igralcev");
        if (!G.teamSize && G.crew === c) b.className = "on";
        b.addEventListener("click", function () { setTeamSize(0, 4, c); });
        r1.appendChild(b);
      });
      var lab = document.createElement("span"); lab.className = "lab"; lab.textContent = "Tekma, na splav:"; r1.appendChild(lab);
      [1, 2, 3, 4].forEach(function (v) { btn(String(v), "Tekma, " + v + " na splav", v); });
      var note = document.createElement("span"); note.className = "note";
      if (!G.teamSize) note.textContent = G.crew > 4 ? "do " + G.crew + " igralcev na enem splavu (telefoni)" : "vsi skupaj vozijo en splav";
      else if (id === "raceMenu") {
        var n = Math.min(G.raftMax, Math.ceil(G.n / G.teamSize));
        note.textContent = n > 1 ? n + " splavi tekmujejo (tipkovnica: " + G.n + " igralci)" : "na tipkovnici izberi več igralcev za tekmo";
      } else note.textContent = "do " + G.teamSize * G.raftMax + " igralcev, " + G.raftMax + " splavi; reka se razširi";
      r1.appendChild(note);
      // hitre izbire: ekipa proti ekipi
      var r2 = document.createElement("div"); r2.className = "farts-row"; box.appendChild(r2);
      var lab2 = document.createElement("span"); lab2.className = "lab"; lab2.textContent = "Ekipe:"; r2.appendChild(lab2);
      btn("2 proti 2", "Dva splava, po 2 igralca", 2, 2, r2);
      btn("3 proti 3", "Dva splava, po 3 igralci", 3, 2, r2);
      btn("4 proti 4", "Dva splava, po 4 igralci", 4, 2, r2);
      btn("3 splavi po 2", "Trije splavi, po 2 igralca", 2, 3, r2);
    });
  }

  // Izbira proge — v meniju in v sobi pred »Začni vožnjo« (ista izbira).
  function renderLevels() {
    renderFarts();
    renderRace();
    var tab = G.tab || LEVELS[G.lv].tier || 1;
    ["lvPick", "lobbyLv"].forEach(function (id) {
      var box = $(id);
      box.innerHTML = "";
      // zavihki: Level 1 (prve proge), Level 2 (nove, težje)
      var tabs = document.createElement("div"); tabs.className = "lv-tabs"; tabs.setAttribute("role", "tablist");
      [1, 2].forEach(function (t) {
        var tb = document.createElement("button");
        tb.type = "button"; tb.setAttribute("role", "tab"); tb.setAttribute("aria-selected", String(t === tab));
        tb.className = t === tab ? "on" : "";
        var cnt = LEVELS.filter(function (l) { return (l.tier || 1) === t; }).length;
        tb.textContent = "Level " + t;
        var sm0 = document.createElement("small"); sm0.textContent = cnt + " prog"; tb.appendChild(sm0);
        tb.addEventListener("click", function () { G.tab = t; renderLevels(); });
        tabs.appendChild(tb);
      });
      box.appendChild(tabs);
      LEVELS.forEach(function (lv, i) {
        if ((lv.tier || 1) !== tab) return;
        var b = document.createElement("button");
        b.type = "button";
        if (i === G.lv) b.className = "on";
        b.appendChild(document.createTextNode(lv.name));
        var sm = document.createElement("small");
        sm.textContent = G.best[lv.name] ? "rekord " + fmt(G.best[lv.name]) : "še brez rekorda";
        b.appendChild(sm);
        b.addEventListener("click", function () {
          G.lv = i; G.tab = LEVELS[i].tier || 1; resetRaft(LEVELS[i]); renderLevels();
          pushState(true); // telefoni vidijo izbrano progo
        });
        box.appendChild(b);
      });
    });
  }

  function toMenu() {
    if (G.mode === "tel" && tel.room) { toLobby(); return; }
    G.phase = "menu";
    G.players = makePlayers(kbList());
    resetRaft(LEVELS[G.lv]);
    $("btnPause").hidden = true;
    renderLevels();
    showOnly("menu");
  }

  function toLobby() {
    G.phase = "lobby";
    G.players = makePlayers(tel.players.filter(function (p) { return !p.waiting; }));
    resetRaft(LEVELS[G.lv]);
    $("btnPause").hidden = true;
    tel.admitWaiting();
    showOnly("lobby");
    pushState(true);
  }

  function next() {
    if (G.lv < LEVELS.length - 1) startLevel(G.lv + 1);
    else startLevel(G.lv);
  }

  $("nPick").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    G.n = Number(b.getAttribute("data-n"));
    Array.prototype.forEach.call(this.children, function (c) { c.classList.toggle("on", c === b); });
    renderKeys();
    renderRace();
    G.players = makePlayers(kbList());
    resetRaft(LEVELS[G.lv]);
  });
  $("btnKb").addEventListener("click", function () { G.mode = "kb"; tel.close(); startLevel(G.lv); });
  $("btnTel").addEventListener("click", function () {
    if (!me) return;
    G.mode = "tel";
    sound.unlock();
    tel.open();
    toLobby();
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
  });
  $("btnStart").addEventListener("click", beginTel);
  $("btnLobbyBack").addEventListener("click", function () { tel.close(); G.mode = "kb"; toMenu(); });
  $("btnNext").addEventListener("click", next);
  $("btnRetry").addEventListener("click", function () { startLevel(G.lv); });
  $("btnMenu").addEventListener("click", function () { if (G.mode === "tel") toLobby(); else toMenu(); });
  $("btnPause").addEventListener("click", toMenu);
  $("btnFs").addEventListener("click", function () {
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  });

  var GAME_KEYS = {};
  KEYS.forEach(function (k) { k.l.concat(k.r, k.f).forEach(function (c) { GAME_KEYS[c] = true; }); });
  window.addEventListener("keydown", function (e) {
    if (GAME_KEYS[e.code] && (G.phase === "play" || G.phase === "count")) e.preventDefault();
    keysDown[e.code] = true;
    sound.unlock();
    if (e.code === "Escape" && (G.phase === "play" || G.phase === "count")) toMenu();
    if ((e.code === "Enter" || e.code === "NumpadEnter") && (G.phase === "end" || G.phase === "over")) {
      if (G.phase === "end" && G.lv < LEVELS.length - 1) next(); else startLevel(G.lv);
    }
    if (e.code === "KeyR" && (G.phase === "play" || G.phase === "over" || G.phase === "end")) startLevel(G.lv);
  });
  window.addEventListener("keyup", function (e) { keysDown[e.code] = false; });
  window.addEventListener("blur", function () { keysDown = {}; });

  // kurzor se skrije med igro, ko miruje
  var cursorT = null;
  window.addEventListener("mousemove", function () {
    document.body.classList.remove("hide-cursor");
    clearTimeout(cursorT);
    cursorT = setTimeout(function () {
      if (G.phase === "play" || G.phase === "count") document.body.classList.add("hide-cursor");
    }, 2000);
  });

  // telefon → takoj kontroler: kdor ima Prdoplav odprt na telefonu, je samodejno v vrsti
  // Prepoznava: brskalnik pove, da je mobilni (UA / userAgentData), ali pa dotik brez miške na
  // ozkem zaslonu. (Prej samo slednje — nekateri Androidi, npr. s pisalom, so ostali na domači strani.)
  // ?zaslon v naslovu = vseeno veliki zaslon (npr. tablica kot gostitelj).
  var ua = navigator.userAgent || "";
  var mobileUa = (navigator.userAgentData && navigator.userAgentData.mobile) ||
    /Android.+Mobile|iPhone|iPod|Windows Phone|Mobile Safari|Opera Mini|IEMobile/i.test(ua);
  var coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  var smallTouch = coarse && Math.min(screen.width, screen.height) < 600;
  if (!/[?&]zaslon\b/.test(location.search) && (mobileUa || smallTouch)) {
    $("phoneHint").hidden = false; // rezerva, če preusmeritev ne uspe
    document.body.classList.add("is-phone");
    location.replace("prdoplav-kontroler.html");
    return;
  }
  // naprava z dotikom, ki je nismo preusmerili (npr. tablica): gumb za kontroler na vrhu
  if (coarse) $("phoneHint").hidden = false;

  /* =================== Zagon =================== */
  $("viewPick").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (b) setView(b.getAttribute("data-v"));
  });
  var savedView = "3d";
  try { savedView = localStorage.getItem("prdoplav-view") || "3d"; } catch (e) {}
  setView(savedView);

  renderKeys();
  renderLevels();
  G.players = makePlayers(kbList());
  resetRaft(LEVELS[0]);
  requestAnimationFrame(loop);

  var telBtn = $("btnTel"), telNote = $("telNote");
  telBtn.disabled = true;
  if (!sb) {
    telNote.hidden = false; telNote.textContent = "Povezava s TomsStudiom ni na voljo.";
  } else {
    sb.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      if (!s) {
        telNote.hidden = false;
        telNote.textContent = "Za sobo s telefoni se najprej prijavi na plošči TomsStudia.";
        return;
      }
      me = s.user;
      NET.myName(sb, me).then(function (n) { tel.hostName = n; });
      telBtn.disabled = false;
      tel.watch(); // vidi čakalno vrsto telefonov že pred odprtjem sobe
      $("btnQOpen").addEventListener("click", function () { telBtn.click(); });
    }, function () {
      telNote.hidden = false; telNote.textContent = "Ni povezave.";
    });
  }
})();
