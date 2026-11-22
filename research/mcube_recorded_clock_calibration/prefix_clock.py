"""Take a causal prefix from a single ordered source channel in recorded time."""
from bisect import bisect_right
from decimal import Decimal


def finite_time(value):
    time = Decimal(str(value))
    if not time.is_finite():
        raise ValueError("Nonfinite log time")
    return time


def causal_prefix(rows, cutoff, grid, *, clock_offset=0, max_age):
    """A timestamp denotes log availability; physical delays require separate evidence.

    Only the timestamp of the first later row is read. A release-time policy
    must guarantee source order upstream before using this routine.
    """
    cutoff, offset, age = map(finite_time, (cutoff, clock_offset, max_age))
    grid = [finite_time(t) for t in grid]
    if age < 0 or any(t > cutoff for t in grid):
        raise ValueError("Invalid age or grid outside prefix")
    if any(b <= a for a, b in zip(grid, grid[1:])):
        raise ValueError("Query grid must increase")
    stamps, values = [], []
    for row in rows:
        stamp = finite_time(row[0]) + offset
        if stamps and stamp < stamps[-1]:
            raise ValueError("Unordered source prefix")
        if stamp > cutoff:
            break
        value = tuple(row[1:])
        if stamps and stamp == stamps[-1]:
            if value != values[-1]:
                raise ValueError("Ambiguous duplicate timestamp")
            continue
        stamps.append(stamp)
        values.append(value)
    output = []
    for time in grid:
        idx = bisect_right(stamps, time) - 1
        if idx < 0 or time - stamps[idx] > age:
            output.append(None)
        else:
            output.append((stamps[idx], values[idx]))
    return output


def qualify():
    class FutureTimeOnly:
        def __getitem__(self, key):
            if key == 0:
                return "1000.130000000"
            raise AssertionError("Tried to read a future value")

    def example():
        yield ("1000.100000000", 1, 2)
        yield ("1000.110000000", 3, 4)
        yield ("1000.110000000", 3, 4)
        yield FutureTimeOnly()
        raise AssertionError("Consumed suffix")

    grid = ["1000.095", "1000.100", "1000.108", "1000.110", "1000.125"]
    out = causal_prefix(example(), grid[-1], grid, max_age="0.010")
    assert [None if x is None else x[1] for x in out] == [None, (1, 2), (1, 2), (3, 4), None]
    assert out[1][0] == Decimal("1000.100") and out[3][0] == Decimal("1000.110")
    other = [(100, 0), (101, 1), (101, 2)]
    try:
        causal_prefix(other, 101, [100, 101], max_age=1)
    except ValueError as exc:
        assert str(exc) == "Ambiguous duplicate timestamp"
    else:
        raise AssertionError("Accepted conflicting duplicates")
    print("Recorded-time prefix checks passed: cutoff, age, exact duplicates, conflicting duplicate and unread future.")


if __name__ == "__main__":
    qualify()
