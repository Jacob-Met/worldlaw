"""Replay the twelve-pulse two-triple obstruction from exact original position equations."""
import argparse
from fractions import Fraction as F
from itertools import permutations
import json
from pathlib import Path

HORIZON = 12
RADIUS = F(1, 10)
TRIPLES = (('y0','x0','z0'), ('z1','x1','y1'))


def require(ok, message):
    if not ok:
        raise ValueError(message)


def words(remaining):
    # Each rank is a complete selected program. No observations select subsequent runs.
    for triple in TRIPLES:
        for order in permutations(triple):
            for first in range(1,remaining-1):
                for second in range(1,remaining-first):
                    yield ((order[0],first),(order[1],second),(order[2],remaining-first-second))


def rational(x):
    require(type(x) in (str,int),'expected exact integer or rational text')
    return F(x)


def check(source, packet):
    catalog = source['catalog']
    require(packet['schema']=='worldlaw.twelve-pulse-dwell-obstruction/v1'
            and packet['horizon']==HORIZON and rational(packet['noiseBound'])==RADIUS,
            'incorrect course or radius')
    require(packet['catalog']==catalog and rational(catalog['noiseBound'])==RADIUS,
            'source catalog or noise differs')
    commands = catalog['commands']
    require(len(commands)==len(set(commands)) and set(commands)=={'ref','group',*TRIPLES[0],*TRIPLES[1]},
            'unexpected command vocabulary')
    families = catalog['laws']
    require([law['id'] for law in families]==['A','B'],'expected the two registered families')
    vertices = [[[rational(x) for x in row] for row in law['vertices']] for law in families]
    require(all(len(v)==4 and all(len(r)==len(commands) for r in v) for v in vertices),
            'unexpected source vertex dimensions')

    # Every tuple stores three independent masses, an origin and a constant drift per family.
    trajectories = []
    for row in packet['worldPairs']:
        require(len(row)==10,'incorrect world-pair width')
        row = list(map(rational,row))
        pair = []
        for law in (0,1):
            masses=row[3*law:3*law+3]
            masses=masses+[1-sum(masses)]
            require(min(masses)>=0,'mixture outside the closed simplex')
            velocity={name:row[7+2*law]+sum(w*v[j] for w,v in zip(masses,vertices[law]))
                      for j,name in enumerate(commands)}
            pair.append((row[6+2*law],velocity))
        trajectories.append(pair)

    expected={(m,g) for m in range(1,HORIZON) for g in range(1,HORIZON)
              if m+g+3<=HORIZON}
    seen=set()
    used=set()
    leaves=world_ticks=0
    for m,g,reading,indices in packet['prefixes']:
        require(type(m) is int and type(g) is int and (m,g) in expected-seen,'invalid or duplicate prefix')
        seen.add((m,g))
        y=rational(reading)
        options=list(words(HORIZON-m-g))
        require(len(options)==len(indices),'a continuation is missing or duplicated')
        for word,index in zip(options,indices):
            require(type(index) is int and 0<=index<len(trajectories),'invalid world-pair index')
            used.add(index)
            pair=trajectories[index]
            position=[world[0] for world in pair]
            require(all(abs(p)<=RADIUS for p in position),'initial tube failed')
            world_ticks+=2
            tick=0
            for command,count in (('ref',m),('group',g),*word):
                for _ in range(count):
                    tick+=1
                    for law in (0,1):
                        position[law]+=pair[law][1][command]
                    if tick<=m:
                        observed=F(0)
                    elif tick<=m+g:
                        observed=y*F(tick-m,g)
                    else:
                        observed=(position[0]+position[1])/2
                    require(all(abs(p-observed)<=RADIUS for p in position),
                            f'position tube failed for prefix {(m,g)}, word {word}, tick {tick}')
                    world_ticks+=2
            require(tick==HORIZON,'terminal length mismatch')
            leaves+=1
    require(seen==expected and used==set(range(len(trajectories))),'incomplete prefix or world coverage')
    return dict(radius=str(RADIUS),prefixes=len(seen),continuations=leaves,
                distinctWorldPairs=len(trajectories),originalWorldTicks=world_ticks)


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('source',type=Path)
    ap.add_argument('certificate',type=Path)
    args=ap.parse_args()
    print(json.dumps(check(json.loads(args.source.read_text()),json.loads(args.certificate.read_text()))))
