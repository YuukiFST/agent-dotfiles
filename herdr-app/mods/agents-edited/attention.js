// The light on a session that wants the person: a glow breathing in from the row's edge and a
// pulsing orb. Needs you also sends a soft beam across the row; done stays calmer, because it only
// reports. Every motion is a native .loop(): it costs no render and stops when not drawn.

import { div, PathBuilder, Background } from "gpui-kit";

const BEAM_WIDTH = 200;
const BEAM_TRAVEL = 520;
const ORB_SIZE = 14;
const CORE_SIZE = 6;

// "done" is finished and not looked at yet; looking turns it into "idle", which ends the light.
const ALERTS = {
  blocked: { color: (t) => t.blocked, word: "Needs you", breath: 1800, beam: 4200 },
  done: { color: (t) => t.done, word: "Done", breath: 3200, beam: null },
};

// { color, word, breath, beam } for a status that wants the person, else null.
export function alertOf(t, status) {
  const alert = ALERTS[status];
  return alert ? { ...alert, color: alert.color(t) } : null;
}

const wholeBox = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();
const gradientFill = (angle, from, to) => window.paint_path(wholeBox(), Background.linear_gradient(angle, from, to)).absolute().top(0).left(0).size_full();

const glow = (alert) => div().absolute().left(0).top(0).bottom(0).w("70%")
  .loop("opacity", { from: 0.35, to: 1, period: alert.breath })
  .child(gradientFill(90, `${alert.color}47`, `${alert.color}00`));

const edge = (alert) => div().absolute().left(0).top(0).bottom(0).w(2)
  .loop("opacity", { from: 0.45, to: 1, period: alert.breath })
  .child(gradientFill(180, `${alert.color}00`, alert.color))
  .bg(alert.color);

const beam = (alert) => div().absolute().top(0).bottom(0).w(BEAM_WIDTH)
  .loop("left", { from: -BEAM_WIDTH, to: BEAM_TRAVEL, period: alert.beam })
  .child(div().absolute().left(0).top(0).bottom(0).w(BEAM_WIDTH / 2).child(gradientFill(90, `${alert.color}00`, `${alert.color}33`)))
  .child(div().absolute().right(0).top(0).bottom(0).w(BEAM_WIDTH / 2).child(gradientFill(90, `${alert.color}33`, `${alert.color}00`)));

// The layers to put first in a relative(), overflow_hidden() row, so its content draws over them.
export function alertLight(alert) {
  return [glow(alert), edge(alert), alert.beam ? beam(alert) : null].filter(Boolean);
}

export function alertOrb(alert) {
  const rest = (ORB_SIZE - CORE_SIZE) / 2;
  const halo = div().absolute().rounded(ORB_SIZE).bg(`${alert.color}80`)
    .loop("width", { from: CORE_SIZE, to: ORB_SIZE, period: alert.breath })
    .loop("height", { from: CORE_SIZE, to: ORB_SIZE, period: alert.breath })
    .loop("left", { from: rest, to: 0, period: alert.breath })
    .loop("top", { from: rest, to: 0, period: alert.breath })
    .loop("opacity", { from: 0.9, to: 0.15, period: alert.breath });
  return div().relative().size(ORB_SIZE).flex_none()
    .child(halo)
    .child(div().absolute().left(rest).top(rest).size(CORE_SIZE).rounded(CORE_SIZE).bg(alert.color));
}
