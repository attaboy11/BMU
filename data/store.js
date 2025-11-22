// Simple in-memory data store for BMU Fault Finder
// Structured so the same shapes can be used on the client for offline data.

const bmuModels = [
  {
    id: "alimak-a1",
    name: "Alimak Horizon A1",
    manufacturer: "Alimak",
    site: "Harbor Tower",
    notes: "Twin trolley with slewing cradle and PLC control",
  },
  {
    id: "alimak-a2",
    name: "Alimak Skyline A2",
    manufacturer: "Alimak",
    site: "Skyline Plaza",
    notes: "Telescopic jib with dual hoists and encoder feedback",
  },
  {
    id: "gondola-g1",
    name: "GondolaTech G1",
    manufacturer: "GondolaTech",
    site: "Marina Residences",
    notes: "Compact roof trolley with pendant and radio backup",
  },
];

const subsystems = [
  { id: "travel", modelIds: ["alimak-a1", "alimak-a2", "gondola-g1"], name: "Trolley Travel" },
  { id: "hoist", modelIds: ["alimak-a1", "alimak-a2"], name: "Hoist" },
  { id: "slew", modelIds: ["alimak-a1"], name: "Slew" },
  { id: "power", modelIds: ["alimak-a1", "alimak-a2", "gondola-g1"], name: "Power" },
  { id: "plc", modelIds: ["alimak-a1", "alimak-a2"], name: "PLC / Control" },
];

const symptoms = [
  {
    id: "trolley-stopped",
    subsystemId: "travel",
    title: "Trolley not travelling",
    description: "No movement when travel command given",
  },
  {
    id: "hoist-no-lift",
    subsystemId: "hoist",
    title: "Hoist won't raise",
    description: "Hoist dead when up command made",
  },
  {
    id: "estop-stuck",
    subsystemId: "power",
    title: "E-stop not resetting",
    description: "E-stop circuit remains latched",
  },
  {
    id: "plc-fault",
    subsystemId: "plc",
    title: "PLC in fault",
    description: "PLC shows fault LED after power cycle",
  },
];

const components = [
  {
    id: "travel-limit",
    modelId: "alimak-a1",
    subsystemId: "travel",
    name: "Forward travel limit switch",
    partNumber: "ALM-TRL-LIM-01",
    location: "Mounted on trolley side rail near drive gearbox",
    failureModes: ["Switch stuck open", "Actuator bent"],
    symptoms: ["Trolley not travelling", "Stops before end of rail"],
    replacement: "Isolate power, lock off, remove switch bracket, swap like-for-like, adjust cam",
  },
  {
    id: "travel-contactor",
    modelId: "alimak-a1",
    subsystemId: "travel",
    name: "Travel contactor",
    partNumber: "ALM-CTL-TRV-10",
    location: "Control panel A1, lower left contactor bank",
    failureModes: ["Coil open", "Contacts pitted"],
    symptoms: ["Trolley not travelling", "Intermittent travel"],
    replacement: "Isolate panel, label wiring, replace contactor and test coil voltage",
  },
  {
    id: "hoist-encoder",
    modelId: "alimak-a2",
    subsystemId: "hoist",
    name: "Hoist encoder",
    partNumber: "ALM-HST-ENC-22",
    location: "Hoist motor tail shaft, encoder housing",
    failureModes: ["Encoder not counting", "Connector loose"],
    symptoms: ["Hoist won't raise", "Erratic speed"],
    replacement: "Isolate hoist, remove cover, swap encoder, verify direction",
  },
  {
    id: "plc-safety-relay",
    modelId: "alimak-a1",
    subsystemId: "plc",
    name: "Safety relay",
    partNumber: "ALM-PLC-SAF-05",
    location: "Main cabinet row 2, yellow safety relay",
    failureModes: ["Contacts welded", "Reset circuit failed"],
    symptoms: ["E-stop not resetting", "PLC fault"],
    replacement: "Isolate, remove relay from DIN rail, replace and function test",
  },
  {
    id: "pendant-cable",
    modelId: "gondola-g1",
    subsystemId: "power",
    name: "Pendant cable",
    partNumber: "GND-PEN-07",
    location: "Hangs from trolley control box",
    failureModes: ["Core broken", "Connector damaged"],
    symptoms: ["No power at pendant"],
    replacement: "Unplug, inspect pins, replace cable, test controls",
  },
];

const safetyNotes = [
  {
    id: "lock-off",
    text: "Isolate and lock-off BMU main power before panel work. Verify absence of voltage.",
  },
  {
    id: "height",
    text: "Use fall protection and stay within guardrails when accessing trolley or jib.",
  },
  {
    id: "stored-energy",
    text: "Beware of stored energy in hoist brakes and hydraulic accumulators. Release safely.",
  },
];

const faultFlows = [
  {
    id: "travel-no-move",
    modelIds: ["alimak-a1", "alimak-a2"],
    subsystemId: "travel",
    symptomId: "trolley-stopped",
    likelyCauses: [
      { component: "Forward travel limit switch", probability: 0.38 },
      { component: "Travel contactor coil", probability: 0.26 },
      { component: "Pendant e-stop circuit open", probability: 0.14 },
      { component: "Travel inverter faulted", probability: 0.12 },
      { component: "Busbar collector carbon worn", probability: 0.1 },
    ],
    checks: [
      { id: "c1", text: "Verify e-stop chain reset; measure 24V across safety relay A1/A2", expected: "24V present" },
      { id: "c2", text: "Check forward travel limit continuity when actuated", expected: "< 1Ω when pressed" },
      { id: "c3", text: "Command travel; measure contactor coil voltage", expected: "230VAC coil when joystick held" },
      { id: "c4", text: "Observe inverter display for fault code", expected: "Ready / no active fault" },
    ],
    steps: [
      {
        id: "s1",
        title: "Confirm power and safety chain",
        detail: "Reset e-stops, confirm 24V control present, check safety relay LED.",
        nextOnPass: "s2",
        nextOnFail: "saf-lock",
      },
      {
        id: "s2",
        title: "Inspect travel limit switches",
        detail: "Manually actuate forward and reverse limits; check continuity and adjust cams.",
        nextOnPass: "s3",
        nextOnFail: "resolve-limit",
      },
      {
        id: "s3",
        title: "Check travel contactor and inverter",
        detail: "Command travel while probing coil voltage; observe inverter ready/fault status.",
        nextOnPass: "s4",
        nextOnFail: "resolve-contactor",
      },
      {
        id: "s4",
        title: "Inspect busbar collectors",
        detail: "Inspect carbon shoes and springs; clean and ensure full contact.",
        nextOnPass: null,
        nextOnFail: "replace-collector",
      },
    ],
    resolutions: {
      "saf-lock": "Restore safety chain, replace faulty e-stop or safety relay module.",
      "resolve-limit": "Replace or adjust limit switch; verify correct travel direction interlocks.",
      "resolve-contactor": "Replace contactor or investigate inverter fault code per manual.",
      "replace-collector": "Replace worn collectors; verify busbar alignment.",
    },
    safety: ["lock-off", "height"],
  },
  {
    id: "hoist-no-raise",
    modelIds: ["alimak-a2"],
    subsystemId: "hoist",
    symptomId: "hoist-no-lift",
    likelyCauses: [
      { component: "Hoist encoder miscount", probability: 0.32 },
      { component: "Up limit engaged", probability: 0.22 },
      { component: "Hoist brake stuck", probability: 0.18 },
      { component: "Overload tripped", probability: 0.16 },
      { component: "PLC inhibit", probability: 0.12 },
    ],
    checks: [
      { id: "h1", text: "Check overload relay reset; verify load < SWL", expected: "Relay reset and load within range" },
      { id: "h2", text: "Inspect up limit cam position", expected: "Cam clear and switch closed when lowered" },
      { id: "h3", text: "Monitor encoder counts in PLC diagnostics", expected: "Counts increasing when manually turning" },
      { id: "h4", text: "Check brake release voltage", expected: "200-230VDC during lift command" },
    ],
    steps: [
      {
        id: "hstep1",
        title: "Confirm overload and up limit",
        detail: "Reset overload relay, ensure no obstruction, confirm up limit not made.",
        nextOnPass: "hstep2",
        nextOnFail: "hres-limit",
      },
      {
        id: "hstep2",
        title: "Check encoder feedback",
        detail: "View encoder counts in PLC diagnostics; if static, inspect encoder coupling and cable.",
        nextOnPass: "hstep3",
        nextOnFail: "hres-encoder",
      },
      {
        id: "hstep3",
        title: "Inspect hoist brake",
        detail: "Listen for brake lift when command given; measure brake voltage at terminals.",
        nextOnPass: null,
        nextOnFail: "hres-brake",
      },
    ],
    resolutions: {
      "hres-limit": "Adjust/replace up limit or clear obstruction; reset overload relay.",
      "hres-encoder": "Replace encoder or repair wiring; retest counts and direction.",
      "hres-brake": "Service brake, replace coil or rectify air gap; verify brake lifts cleanly.",
    },
    safety: ["lock-off", "stored-energy"],
  },
  {
    id: "estop-loop",
    modelIds: ["alimak-a1", "gondola-g1"],
    subsystemId: "power",
    symptomId: "estop-stuck",
    likelyCauses: [
      { component: "Pendant e-stop switch stuck", probability: 0.34 },
      { component: "Safety relay faulted", probability: 0.28 },
      { component: "Emergency limit made", probability: 0.18 },
      { component: "Harness break", probability: 0.12 },
      { component: "PLC safety input fault", probability: 0.08 },
    ],
    checks: [
      { id: "e1", text: "Inspect pendant and cab e-stop buttons for mechanical damage", expected: "Buttons released and contacts open" },
      { id: "e2", text: "Measure loop continuity across safety chain", expected: "< 10Ω across loop" },
      { id: "e3", text: "Observe safety relay LEDs", expected: "K1/K2 lit, reset LED green" },
    ],
    steps: [
      {
        id: "estep1",
        title: "Visual and reset checks",
        detail: "Reset all e-stops, inspect mushroom heads, check emergency limits and cable tension switches.",
        nextOnPass: "estep2",
        nextOnFail: "e-res-reset",
      },
      {
        id: "estep2",
        title: "Test loop continuity",
        detail: "Isolate control circuit, measure loop continuity end-to-end, wiggle harness to expose breaks.",
        nextOnPass: "estep3",
        nextOnFail: "e-res-harness",
      },
      {
        id: "estep3",
        title: "Check safety relay / PLC input",
        detail: "Check relay status, replace if K1/K2 not pulling in; confirm PLC safety bit toggles.",
        nextOnPass: null,
        nextOnFail: "e-res-relay",
      },
    ],
    resolutions: {
      "e-res-reset": "Replace damaged e-stop; free up switch; reset emergency limits.",
      "e-res-harness": "Repair harness / pendant cable; re-terminate connectors.",
      "e-res-relay": "Replace safety relay; validate PLC safety input operation.",
    },
    safety: ["lock-off", "height"],
  },
];

const jobs = [];

function findModel(modelId) {
  return bmuModels.find((m) => m.id === modelId);
}

module.exports = {
  bmuModels,
  subsystems,
  symptoms,
  components,
  faultFlows,
  safetyNotes,
  jobs,
  findModel,
};
