import Select, { type StylesConfig } from 'react-select'
import type { SelectOption } from './FormSelect'

type FormMultiSelectProps = {
  inputId?: string
  options: SelectOption[]
  value: SelectOption[]
  onChange: (options: SelectOption[]) => void
  placeholder?: string
  isDisabled?: boolean
  isSearchable?: boolean
  'aria-label'?: string
}

const styles: StylesConfig<SelectOption, true> = {
  control: (base, state) => ({
    ...base,
    minHeight: 42,
    borderRadius: 8,
    borderColor: state.isFocused ? 'rgb(16 185 129 / 0.45)' : 'rgb(226 232 240)',
    boxShadow: state.isFocused ? '0 0 0 2px rgb(16 185 129 / 0.2)' : 'none',
    '&:hover': { borderColor: 'rgb(203 213 225)' },
  }),
  menu: (base) => ({ ...base, zIndex: 60 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
}

export function FormMultiSelect({
  inputId,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  isDisabled,
  isSearchable = true,
  'aria-label': ariaLabel,
}: FormMultiSelectProps) {
  return (
    <Select<SelectOption, true>
      inputId={inputId}
      aria-label={ariaLabel}
      isMulti
      closeMenuOnSelect={false}
      options={options}
      value={value}
      onChange={(v) => onChange(v ? [...v] : [])}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isSearchable={isSearchable}
      styles={styles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
    />
  )
}
