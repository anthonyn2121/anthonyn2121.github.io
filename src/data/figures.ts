/**
 * Constellation figures from public-domain star atlases, registered to the sky.
 * Images live in public/skies/figures/. Each is a white alpha mask that the chart tints.
 */

export interface Figure {
  /** File name in public/skies/figures/. */
  file: string;
  width: number;
  height: number;
  /** Tangent point of the fit, in degrees: [RA 0–360, Dec]. */
  center: [number, number];
  /**
   * Maps gnomonic tangent-plane coordinates (ξ east, η north, radians) to image pixels:
   * px = a·ξ + b·η + c, py = d·ξ + e·η + f, stored as [a, b, c, d, e, f].
   */
  affine: [number, number, number, number, number, number];
  credit: {
    /** e.g. "Uranometria" */
    atlas: string;
    /** e.g. "Johann Bayer" */
    author: string;
    year: number;
    /** Plate name as printed, e.g. "Orion". */
    plate: string;
    /** Wikimedia Commons file page URL. */
    source: string;
    /** e.g. "Public domain" */
    license: string;
  };
}

export const figures: Partial<Record<string, Figure>> = {
  Ori: {
    file: "ori.webp",
    width: 1300,
    height: 1600,
    center: [83, 5],
    affine: [-2104.28, -158.93, 608.11, 145.93, -2298.68, 733.9],
    credit: {
      atlas: "Uranometria",
      author: "Johann Bayer",
      year: 1661,
      plate: "Orion",
      source: "https://commons.wikimedia.org/wiki/File:Ioannis_Bayeri_Rhainani_Vranometria_1661_(84129163).jpg",
      license: "Public domain",
    },
  },
  Sco: {
    file: "sco.webp",
    width: 1600,
    height: 1400,
    center: [250, -27],
    affine: [-2077.07, 273.5, 635.02, -355.5, -2128.64, 755.83],
    credit: {
      atlas: "Uranometria",
      author: "Johann Bayer",
      year: 1603,
      plate: "Scorpius",
      source: "https://commons.wikimedia.org/wiki/File:Scorpius_Uranometria.jpg",
      license: "Public domain",
    },
  },
  CMa: {
    file: "cma.webp",
    width: 1320,
    height: 1600,
    center: [104, -22],
    affine: [-2963.07, 32.3, 386.69, -316.06, -3164.2, 631.16],
    credit: {
      atlas: "Uranometria",
      author: "Johann Bayer",
      year: 1603,
      plate: "Canis Maior",
      source: "https://commons.wikimedia.org/wiki/File:Uranometria_Canis_Major_(1603).jpg",
      license: "Public domain",
    },
  },
  CMi: {
    file: "cmi.webp",
    width: 1400,
    height: 950,
    center: [112, 6],
    affine: [-4976.99, 526.39, 894.87, -3368.12, -6752.58, 521.38],
    credit: {
      atlas: "Uranometria",
      author: "Johann Bayer",
      year: 1603,
      plate: "Canis Minor",
      source: "https://commons.wikimedia.org/wiki/File:Canis_Minor_Uranometria.jpg",
      license: "Public domain",
    },
  },
  CVn: {
    file: "cvn.webp",
    width: 1553,
    height: 1600,
    center: [192, 42],
    affine: [3177.48, -1311.95, 360.33, -1922.18, -3227.86, 747.85],
    credit: {
      atlas: "Firmamentum Sobiescianum",
      author: "Johannes Hevelius",
      year: 1690,
      plate: "Canes Venatici",
      source: "https://commons.wikimedia.org/wiki/File:CanesVenatici_Hevelius.jpg",
      license: "Public domain",
    },
  },
  UMa: {
    file: "uma.webp",
    width: 1600,
    height: 1276,
    center: [165, 50],
    affine: [-1406.9, 807.95, 740.06, -950.83, -1400.4, 760.54],
    credit: {
      atlas: "Uranometria",
      author: "Johann Bayer",
      year: 1661,
      plate: "Ursa Maior",
      source: "https://commons.wikimedia.org/wiki/File:Ioannis_Bayeri_Rhainani_Vranometria_1661_(84120344).jpg",
      license: "Public domain",
    },
  },
  Per: {
    file: "per.webp",
    width: 1483,
    height: 1600,
    center: [50, 44],
    affine: [-2313.91, -857.32, 761.85, 785.81, -2577.24, 820],
    credit: {
      atlas: "Uranometria",
      author: "Johann Bayer",
      year: 1603,
      plate: "Perseus",
      source: "https://commons.wikimedia.org/wiki/File:Perseus_Uranometria.jpg",
      license: "Public domain",
    },
  },
  And: {
    file: "and.webp",
    width: 1600,
    height: 1525,
    center: [15, 38],
    affine: [-1804.36, -754.36, 762.4, 889.61, -1865.34, 930.62],
    credit: {
      atlas: "Uranometria",
      author: "Johann Bayer",
      year: 1661,
      plate: "Andromeda",
      source: "https://commons.wikimedia.org/wiki/File:Ioannis_Bayeri_Rhainani_Vranometria_1661_(84125966).jpg",
      license: "Public domain",
    },
  },
  Cas: {
    file: "cas.webp",
    width: 1600,
    height: 1051,
    center: [12, 60],
    affine: [-2212.58, -1922.94, 980.56, 1901.26, -2355.35, 414.67],
    credit: {
      atlas: "Uranometria",
      author: "Johann Bayer",
      year: 1661,
      plate: "Cassiopeia",
      source: "https://commons.wikimedia.org/wiki/File:Ioannis_Bayeri_Rhainani_Vranometria_1661_(84123129).jpg",
      license: "Public domain",
    },
  },
  Cep: {
    file: "cep.webp",
    width: 1600,
    height: 1288,
    center: [330, 68],
    affine: [263.42, -2011.49, 1056.87, 2097.86, 337.61, 687.71],
    credit: {
      atlas: "Uranometria",
      author: "Johann Bayer",
      year: 1661,
      plate: "Cepheus",
      source: "https://commons.wikimedia.org/wiki/File:Ioannis_Bayeri_Rhainani_Vranometria_1661_(84121091).jpg",
      license: "Public domain",
    },
  },
  Cet: {
    file: "cet.webp",
    width: 1600,
    height: 1119,
    center: [25, -5],
    affine: [-1262.23, -536.62, 770.47, 549.1, -1400.68, 355.48],
    credit: {
      atlas: "Uranometria",
      author: "Johann Bayer",
      year: 1661,
      plate: "Cetus",
      source: "https://commons.wikimedia.org/wiki/File:Ioannis_Bayeri_Rhainani_Vranometria_1661_(84128958).jpg",
      license: "Public domain",
    },
  },
  Peg: {
    file: "peg.webp",
    width: 1600,
    height: 1210,
    center: [347, 14],
    affine: [-1441.44, -633.03, 878.9, 664.83, -1535.97, 899.23],
    credit: {
      atlas: "Uranometria",
      author: "Johann Bayer",
      year: 1603,
      plate: "Pegasus",
      source: "https://commons.wikimedia.org/wiki/File:Pegasus_Uranometria.jpg",
      license: "Public domain",
    },
  },
};
