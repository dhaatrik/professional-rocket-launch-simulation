# 🎮 DeltaV Lab: Simulation Controls

This guide outlines all the keyboard controls and shortcuts available across DeltaV Lab's various systems (Launch Pad, Flight, Mission Control, and Instructor Tools).

## Flight & Propulsion Controls

| Key | Action | Description / Context |
|-----|--------|-----------------------|
| `SPACE` | **Launch** / **Stage** | Primary action button. Ignites engines on the pad, and triggers stage separation in-flight. |
| `S` | **Force Staging** | Manually override and force a separation sequence regardless of current fuel limits. |
| `Shift` | **Throttle Up** | Increases engine throttle in increments of 10%. |
| `Ctrl` | **Throttle Down** | Decreases engine throttle in decrements of 10%. |
| `X` | **Cut Engine** | Instantaneous MECO (Main Engine Cut Off) resulting in 0% thrust. |
| `←` `→` | **Steer (Yaw)** | Manual thrust vectoring to steer the rocket left or right. |

## Guidance & Navigation

| Key | Action | Description / Context |
|-----|--------|-----------------------|
| `A` | **Toggle Autopilot** | Cycles between manual, ascent, and landing guidance modes. |
| `G` | **Toggle Flight Computer** | Arms or disarms the programmable guidance system to run your custom DSL script. |
| `F` | **Open Script Editor** | Opens the onboard DSL editor to write mission sequences. |
| `M` | **Toggle Map View** | Switches to orbital map view tracking ground path and apogee/perigee markers. |

## Mission Control & Systems

| Key | Action | Description / Context |
|-----|--------|-----------------------|
| `C` | **Toggle Checklist** | Brings up the pre-launch Go/No-Go checklist validation panel. |
| `R` | **Toggle Black Box** | Starts or stops high-frequency telemetry recording. |
| `E` | **Export Data** | Downloads a CSV of the current telemetry recording for external analysis. |

## Instructor & Safety

| Key | Action | Description / Context |
|-----|--------|-----------------------|
| `T` | **Arm/Disarm FTS** | Toggles the Flight Termination System safety interlock. |
| `Ctrl+I`| **Toggle Fault Injector** | Opens the Instructor Panel to trigger engine flameouts, sensor glitches, or fuel leaks. |

## Simulation Time & Viewports

| Key | Action | Description / Context |
|-----|--------|-----------------------|
| `.` | **Time Warp Speed Up** | Accelerates simulation time (great for coasting). |
| `,` | **Time Warp Slow Down** | Decelerates simulation time down to normal speeds. |
| `1` | **Fixed Camera** | Camera is planted firmly on the ground observing the ascent. |
| `2` | **Follow Camera** | Smooth trailing camera that tracks the center of mass. |
| `3` | **Onboard Camera** | Fixed hard-mounted view from the rocket's fuselage. |
