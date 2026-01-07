// /public/js/utils/emergency.js

export function setupEmergencyToggle({
  checkboxId = 'isEmergencyCheckbox',
  consultationFieldId = 'consultationInputContainer',
  onToggle = null
}) {
  const checkbox = document.getElementById(checkboxId);
  const consultationContainer = document.getElementById(consultationFieldId);

  if (!checkbox || !consultationContainer) return;

  checkbox.addEventListener('change', () => {
    const isEmergency = checkbox.checked;
    consultationContainer.style.display = isEmergency ? 'none' : '';

    if (typeof onToggle === 'function') {
      onToggle(isEmergency);
    }
  });
}
