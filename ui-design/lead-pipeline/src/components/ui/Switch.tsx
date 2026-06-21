interface SwitchProps {
  on: boolean;
  onToggle: () => void;
  label?: string;
}

/** Toggle switch: 42×25 track, accent on / subtle off, white knob slides. */
export function Switch({ on, onToggle, label }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      style={{
        flex: "none",
        width: 42,
        height: 25,
        borderRadius: 99,
        border: "none",
        cursor: "pointer",
        position: "relative",
        padding: 0,
        background: on ? "var(--accent)" : "var(--bg-subtle)",
        transition: "background .15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 20 : 3,
          width: 19,
          height: 19,
          borderRadius: "50%",
          background: "#fff",
          transition: "left .15s",
          boxShadow: "0 1px 2px rgba(0,0,0,.3)",
        }}
      />
    </button>
  );
}
