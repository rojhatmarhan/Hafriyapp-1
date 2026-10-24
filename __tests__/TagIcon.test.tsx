import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import Svg, { Path } from 'react-native-svg';
import TagIcon from '../src/components/TagIcon';

const render = async (el: React.ReactElement) => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(el);
  });
  return renderer!;
};

describe('TagIcon', () => {
  it('renders with default size and color', async () => {
    const r = await render(<TagIcon />);
    const svg = r.root.findByType(Svg);
    expect(svg.props.width).toBe(32);
    expect(svg.props.height).toBe(32);
    expect(svg.props.viewBox).toBe('0 0 24 24');
    expect(r.root.findByType(Path).props.fill).toBe('#444');
  });

  it('applies custom color and size', async () => {
    const r = await render(<TagIcon size={20} color="#FFD500" />);
    const svg = r.root.findByType(Svg);
    expect(svg.props.width).toBe(20);
    expect(svg.props.height).toBe(20);
    const path = r.root.findByType(Path);
    expect(path.props.fill).toBe('#FFD500');
    expect(path.props.fillRule).toBe('evenodd');
    expect(r.toJSON()).toBeTruthy();
  });
});
