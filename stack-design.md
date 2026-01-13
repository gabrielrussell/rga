# Stack-Based Evaluation Design

## The Problem
We need to evaluate: `composite(base_parent(pos), invert(transform_parent(inverse_pos)))`

But both parents might need recursive evaluation, and transform parent needs evaluation at a different position.

## State Machine Approach

Each frame goes through phases:
1. **NEED_BASE**: Need to evaluate base parent at current position
2. **HAVE_BASE**: Base done, need to evaluate transform parent(s)
3. **HAVE_BOTH**: Both done, ready to composite and return

## Stack Frame Structure
```glsl
struct Frame {
    int nodeId;
    vec2 pos;
    int phase; // 0=NEED_BASE, 1=HAVE_BASE, 2=HAVE_BOTH
    vec2 baseValue;
    vec2 transformAccum; // Accumulated transform samples from radial copies
    int radialIndex; // Which radial copy we're on
    bool waitingForChild; // True if we pushed a child and are waiting
}
```

## Execution Flow

```
Push(targetNode, targetPos, NEED_BASE)

while stack not empty:
    frame = peek()

    if frame.phase == NEED_BASE:
        if isRoot(frame.nodeId):
            result = evaluateRoot(frame.pos)
            pop()
            pass result to parent
        elif hasBase:
            if baseIsRoot:
                frame.baseValue = evaluateRoot(frame.pos)
                frame.phase = HAVE_BASE
            else:
                push(baseParent, frame.pos, NEED_BASE)
                frame.waitingForChild = true
        else:
            frame.baseValue = transparent
            frame.phase = HAVE_BASE

    elif frame.phase == HAVE_BASE:
        if !hasTransform:
            result = frame.baseValue
            pop()
            pass result to parent
        elif frame.radialIndex < radialCount:
            tpos = inverseTransform(frame.pos, radialIndex)
            if transformIsRoot:
                sample = evaluateRoot(tpos)
                frame.transformAccum = max(frame.transformAccum, sample)
                frame.radialIndex++
            else:
                push(transformParent, tpos, NEED_BASE)
                frame.waitingForChild = true
        else:
            frame.phase = HAVE_BOTH

    elif frame.phase == HAVE_BOTH:
        result = composite(frame.baseValue, invert(frame.transformAccum))
        pop()
        pass result to parent

    # Handle child returns
    if frame.waitingForChild and childReturned:
        childResult = ...
        if frame.phase == NEED_BASE:
            frame.baseValue = childResult
            frame.phase = HAVE_BASE
            frame.waitingForChild = false
        elif frame.phase == HAVE_BASE:
            frame.transformAccum = max(frame.transformAccum, childResult)
            frame.radialIndex++
            frame.waitingForChild = false
```

## Key Points
- Each push knows exactly what phase it's in
- Results are passed via a return mechanism (could be separate result array)
- Radial iteration happens in HAVE_BASE phase
- No confusion between base and transform values
