# 🚀 DeltaV Lab - Professional Rocket Launch Simulation

<p align="center">
  <img src="https://via.placeholder.com/800x400?text=DeltaV+Lab+Simulation+Demo" alt="DeltaV Lab Simulation Demo">
</p>

<p align="center">
  <strong>Engineering-Grade Spaceflight Simulation.</strong> Features accurate physics using RK4 integration, atmospheric modelling, environmental hazards, autonomous guidance, telemetry recording, and modular vehicle assembly. Inspired by Kerbal Space Program.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/TypeScript-5.3-blue.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/build-esbuild-yellow.svg" alt="Build">
  <img src="https://img.shields.io/badge/tests-vitest-green.svg" alt="Tests">
</p>

## 📑 Table of Contents
- [Quick Start](#-quick-start)
- [Key Features](#-key-features)
- [How to Fly (Controls)](#-how-to-fly-controls--shortcuts)
- [Mission Walkthrough](#-mission-walkthrough-step-by-step)
- [The Flight Computer (DSL)](#-the-flight-computer-dsl)
- [Advanced Under the Hood](#-advanced-under-the-hood)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)

## 🏁 Quick Start

**Prerequisites:** Ensure you have [Node.js](https://nodejs.org/) (v18 or higher) installed.

```bash
# 1. Clone the repository
git clone https://github.com/DhaatuTheGamer/professional-rocket-launch-simulation.git
cd professional-rocket-launch-simulation

# 2. Install dependencies
npm install

# 3. Start the local development server
npm run dev
```

Navigate to `http://localhost:8080` in your browser to start the simulation.
*Note: To view live remote telemetry, open `http://localhost:8080/telemetry.html` on a second monitor.*

## ✨ Key Features

* **Modular Vehicle Assembly (VAB):** Build multi-stage rockets using a catalog of engines (Merlin, Raptor, RL-10), tanks, avionics, and fairings. Calculates real-time Delta-V and TWR.
* **Professional Mission Control:** Includes remote telemetry broadcasting, post-flight replay analysis with synchronized data charts, and CSV/JSON flight log exports.
* **Safety & Instructor Systems:** Features a Flight Termination System (FTS), interactive Go/No-Go checklists, and an Instructor Fault Injection System to trigger engine flameouts, sensor glitches, and more.
* **Deterministic Physics Engine:** Runs at a consistent 50Hz in a Web Worker, ensuring accurate orbital mechanics regardless of rendering framerate.

## 🎮 How to Fly: Controls & Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `SPACE` | **Launch** / **Stage** | Pre-launch / In-flight |
| `S` | Force Staging | Separation override |
| `Shift` | Throttle Up | Increments of 10% |
| `Ctrl` | Throttle Down | Decrements of 10% |
| `X` | Cut Engine | Instant 0% throttle |
| `←` `→` | Steer (Yaw) | Vectoring |
| `A` | Toggle Autopilot | Landing / Ascent modes |
| `G` | Toggle Flight Computer | Activates programmed script |
| `F` | Open Script Editor | Edit mission scripts |
| `C` | Toggle Checklist | View Launch Checklist |
| `T` | Arm/Disarm FTS | Safety system |
| `R` | Toggle Black Box | Start/Stop recording |
| `E` | Export Data | Download CSV telemetry |
| `M` | Toggle Map View | Ground track & orbit |
| `Ctrl+I` | Toggle Fault Injector | Instructor Panel |
| `.` `,` | Time Warp | Speed up / Slow down |
| `1`-`3` | Camera Modes | 1:Fixed, 2:Follow, 3:Onboard |

## 📋 Mission Walkthrough: Step-by-Step

**1. Pre-Launch Configuration**
- Open the **VAB** and select "Falcon 9" preset.
- Click "Go to Pad".
- Press `C` to open the **Launch Checklist**.
- Verify Wind Conditions on HUD (< 15 m/s).
- Click "Verify" on all checklist items until Launch Status is **GO**.

**2. Liftoff**
- Press `SPACE` to ignite engines.
- Monitor TWR on the HUD; ensure it > 1.0.
- Rocket will clear the tower.

**3. Gravity Turn**
- At **1,000m** altitude, tap `→` (Right Arrow) to tilt the rocket slightly (pitch ~85°).
- The rocket will naturally follow the prograde marker due to aerodynamics.
- Keep aerodynamic stress (Max Q) in check by throttling down if necessary around 10km.

**4. Staging**
- Monitor Fuel Gauge.
- When First Stage fuel runs out (or manually), press `SPACE` to **Stage**.
- The booster will separate, and the Second Stage engine will ignite.

**5. Orbital Insertion**
- Pitch down to ~0° (parallel to horizon) once above 60km.
- Accelerate until Velocity > **7,500 m/s**.
- Press `X` to cut engines once Perigee > 150km.

**6. Safety & Emergencies**
- If the rocket deviates from course, press `T` to **ARM** the Flight Termination System.
- Click the red **DESTRUCT** button in the FTS panel to terminate the flight safely.

## 💻 The Flight Computer (DSL)

DeltaV Lab includes an autonomous guidance system powered by a custom Domain Specific Language (DSL).

<details>
<summary><strong>Click to expand DSL Syntax & Examples</strong></summary>

**Syntax:**

```text
WHEN <condition> THEN <action>
WHEN <condition> AND <condition> THEN <action>
```

**Conditions:** `ALTITUDE`, `VELOCITY`, `APOGEE`, `FUEL`, `TIME`

**Operators:** `>`, `<`, `>=`, `<=`, `==`

**Actions:** `PITCH <degrees>`, `THROTTLE <0-100>`, `STAGE`, `SAS <OFF|STABILITY|PROGRADE|RETROGRADE>`

**Example: Gravity Turn to Orbit**

```text
WHEN ALTITUDE > 1000 THEN PITCH 80
WHEN ALTITUDE > 10000 THEN PITCH 60
WHEN ALTITUDE > 30000 THEN PITCH 45
WHEN APOGEE > 100000 THEN THROTTLE 0
```

</details>

## 🔬 Advanced Under the Hood

DeltaV Lab doesn't cut corners on physics. Here is a look at the math powering the simulation.

<details>
<summary><strong>Click to explore Physics, Thermodynamics & Aerodynamics</strong></summary>

* **Aerodynamics & Stability:** Calculates Center of Pressure (CP) vs Center of Mass (CoM). Lift and drag are dynamically calculated based on Angle of Attack (AoA) and Mach number (transonic effects).
* **Thermal Protection (TPS):** Utilizes the Sutton-Graves Equation for stagnation point heating. Simulates realistic mass loss and heat absorption via ablation.
* **Orbital Mechanics:** 4th-order Runge-Kutta (RK4) integration handles inverse-square gravity and orbital maneuver planning (Hohmann Transfers).
* **Environmental Hazards:** Simulates wind shear layers, Dryden-style turbulence, and pressure-dependent engine Specific Impulse (Isp).

</details>

## 📂 Project Structure

```
├── src/
│   ├── types/           # TypeScript interfaces (Units, GameState)
│   ├── physics/         # Core Engine (RK4, Aerodynamics)
│   ├── core/            # Game Loop, PhysicsWorker, SimulationStore
│   ├── safety/          # FTS, Checklist, FaultInjector
│   ├── guidance/        # FlightComputer, Scripts
│   ├── ui/              # HUD, Editors, Panels
│   ├── telemetry/       # BlackBox, Exporter
│   └── main.ts          # Entry point
├── tests/               # Vitest Unit Tests
├── dist/                # Compiled output
└── package.json
```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/DhaatuTheGamer/professional-rocket-launch-simulation/issues).

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

