export function shouldApplyLoad(requestId, loadSequence) {
  return requestId === loadSequence;
}

export function isDragContextActive(state, dragContext) {
  return Boolean(
    state &&
      dragContext &&
      state.sessionId === dragContext.sessionId &&
      state.templateId === dragContext.templateId
  );
}

export function savedTemplateState(state, saved, name) {
  return {
    ...state,
    templateId: saved.id,
    layout: {
      ...state.layout,
      name: saved.title || name
    }
  };
}

export function columnWidthValue(state, fieldId) {
  const column = state?.layout?.columns?.find((item) => item.fieldId === fieldId);
  return column ? String(Math.round(Number(column.width))) : "";
}
