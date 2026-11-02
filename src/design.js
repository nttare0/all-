const platforms = {
  web: 'Use responsive layouts, semantic HTML, keyboard navigation, and progressive enhancement.',
  mobile: 'Respect safe areas, platform conventions, readable text, and comfortable touch targets.',
  desktop: 'Support keyboard workflows, resizable windows, clear focus, and appropriate information density.',
  'cross-platform': 'Share design tokens and interaction principles; adapt navigation and controls to each platform.'
};

export function designBrief({ product, audience, goal, platform, constraints = '' }) {
  return `# Design brief\n\n- Product: ${product}\n- Audience: ${audience}\n- Primary user goal: ${goal}\n- Platform: ${platform}\n- Constraints: ${constraints || 'None provided; confirm important assumptions.'}\n\n## Design direction\n1. Identify the primary task and make its next action unmistakable.\n2. Choose one visual direction that fits the audience; avoid decorative elements without a purpose.\n3. Establish hierarchy with a small type scale, spacing scale, and restrained color palette.\n4. ${platforms[platform]}\n5. Design empty, loading, error, and success states alongside the main flow.\n\n## Minimum implementation\n- Reuse existing components and tokens before adding dependencies.\n- Build the smallest complete flow first; abstract only after repetition emerges.\n- Use native controls and layout primitives where possible.\n- Protect user data and avoid deceptive choices; provide appropriate recovery or confirmation for consequential actions.\n- Verify the result at realistic viewport sizes and with keyboard and assistive technology.`;
}

export function reviewChecklist({ platform, focus = 'all' }) {
  const sections = {
    hierarchy: ['Is the main task clear within a few seconds?', 'Are headings, spacing, and primary actions visually prioritized?', 'Is content specific and concise rather than placeholder copy?'],
    accessibility: ['Can all controls be reached and operated by keyboard?', 'Are labels, focus indicators, and error messages clear?', 'Does text and UI contrast meet applicable WCAG requirements?'],
    responsiveness: ['Does content reflow without unintended clipping or horizontal scrolling?', 'Are touch targets and text usable at small sizes?', platforms[platform]],
    usability: ['Does the system communicate its status and use familiar language?', 'Can users undo, cancel, or recover, and are conventions consistent?', 'Are errors prevented where possible and explained with actionable recovery when they occur?', 'Are choices visible, efficient for frequent users, and free of irrelevant clutter?', 'Is task-focused help easy to find when needed?'],
    safety: ['Are choices honest, with no deceptive consent or hidden costs?', 'Are sensitive data and secrets kept out of client code, logs, and examples?', 'Can users recover from or confirm consequential actions where appropriate?'],
    simplicity: ['Can existing components, native controls, or existing layout primitives replace custom code?', 'Are dependencies and abstractions justified by actual needs?', 'Are loading, empty, error, and success states handled without duplicating logic?']
  };
  const names = focus === 'all' ? Object.keys(sections) : [focus];
  return `# Interface review checklist\n\n${names.map(name => `## ${name[0].toUpperCase() + name.slice(1)}\n${sections[name].map(item => `- [ ] ${item}`).join('\n')}`).join('\n\n')}\n\nThis is a checklist, not an automated audit; inspect and test the actual interface.`;
}
