// The light on a session that wants the person: a glow in from the row's edge and an orb. Needs you
// breathes, because it waits on the person; done holds still, because it only reports and can sit
// unread for hours. Every motion is a native .loop(): it costs no render and stops when not drawn.

import { div, PathBuilder, Background } from "gpui-kit";

const ORB_SIZE = 14;
const CORE_SIZE = 6;

// "done" is finished and not looked at yet; looking turns it into "idle", which ends the light.
const ALERTS = {
  blocked: { color: (t) => t.blocked, word: "Needs you", breath: 1800 },
  done: { color: (t) => t.done, word: "Done", breath: null },
};

// { color, word, breath } for a status that wants the person, else null.
export function alertOf(t, status) {
  const alert = ALERTS[status];
  return alert ? { ...alert, color: alert.color(t) } : null;
}

const wholeBox = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();
const gradientFill = (angle, from, to) => window.paint_path(wholeBox(), Background.linear_gradient(angle, from, to)).absolute().top(0).left(0).size_full();

// A loop only while the alert breathes; a still alert keeps its light at full strength.
const breathe = (el, alert, from) => (alert.breath ? el.loop("opacity", { from, to: 1, period: alert.breath }) : el);

const glow = (alert) => breathe(div().absolute().left(0).top(0).bottom(0).w("70%"), alert, 0.35)
  .child(gradientFill(90, `${alert.color}47`, `${alert.color}00`));

const edge = (alert) => breathe(div().absolute().left(0).top(0).bottom(0).w(2), alert, 0.45)
  .child(gradientFill(180, `${alert.color}00`, alert.color))
  .bg(alert.color);

// The layers to put first in a relative(), overflow_hidden() row, so its content draws over them.
export function alertLight(alert) {
  return [glow(alert), edge(alert)];
}

// The halo pulses by opacity alone: size and position would lay the row out again every frame.
export function alertOrb(alert) {
  const rest = (ORB_SIZE - CORE_SIZE) / 2;
  const halo = div().absolute().left(0).top(0).size(ORB_SIZE).rounded(ORB_SIZE).bg(`${alert.color}80`)
    .loop("opacity", { from: 0.9, to: 0.15, period: alert.breath });
  return div().relative().size(ORB_SIZE).flex_none()
    .when(Boolean(alert.breath), (el) => el.child(halo))
    .child(div().absolute().left(rest).top(rest).size(CORE_SIZE).rounded(CORE_SIZE).bg(alert.color));
}
