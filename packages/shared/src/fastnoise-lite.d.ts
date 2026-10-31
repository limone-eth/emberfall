declare module "fastnoise-lite" {
  export default class FastNoiseLite {
    constructor(seed?: number);
    static NoiseType: { OpenSimplex2: string; OpenSimplex2S: string; Cellular: string; Perlin: string; ValueCubic: string; Value: string };
    static FractalType: { None: string; FBm: string; Ridged: string; PingPong: string };
    SetSeed(seed: number): void;
    SetFrequency(f: number): void;
    SetNoiseType(t: string): void;
    SetFractalType(t: string): void;
    SetFractalOctaves(n: number): void;
    GetNoise(x: number, y: number, z?: number): number;
  }
}
