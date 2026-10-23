export function responsiveLayout(width: number) {
  const available = Number.isFinite(width) ? Math.max(280, width) : 360;
  const isTablet = available >= 768;
  return {
    isTablet,
    pageMaxWidth: isTablet ? 1120 : 720,
    formMaxWidth: isTablet ? 840 : 720,
    gutter: isTablet ? 28 : 20,
  };
}

export function productGrid(width: number) {
  const layout = responsiveLayout(width);
  const available = Math.min(Number.isFinite(width) ? Math.max(280, width) : 360, layout.pageMaxWidth);
  const columns = available >= 1000 ? 5 : available >= 768 ? 4 : available >= 480 ? 3 : 2;
  return {
    ...layout,
    columns,
    cardWidth: (available - layout.gutter * 2 - (columns - 1) * 10) / columns,
  };
}
