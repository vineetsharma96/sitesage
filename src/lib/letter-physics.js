// A held letter must retain finite dynamic properties for its later release.
export function createAnchoredLetter(Matter, { x, y, width, height }) {
  const body = Matter.Bodies.rectangle(x, y, width, height, {
    restitution: .48, friction: .35, frictionAir: .012,
  });
  Matter.Body.setStatic(body, true);
  return body;
}
