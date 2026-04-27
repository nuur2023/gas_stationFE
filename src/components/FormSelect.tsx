import Select, { type StylesConfig } from 'react-select'

export type SelectOption = { value: string; label: string }

type FormSelectProps = {
  inputId?: string
  options: SelectOption[]
  value: SelectOption | null
  onChange: (option: SelectOption | null) => void
  placeholder?: string
  isDisabled?: boolean
  isClearable?: boolean
  /** Typing filters options (react-select default). */
  isSearchable?: boolean
  /** Borderless control for use inside a row with a leading icon prefix (e.g. settings). */
  embedded?: boolean
  'aria-label'?: string
}

const styles: StylesConfig<SelectOption, false> = {
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

const embeddedStyles: StylesConfig<SelectOption, false> = {
  control: (base) => ({
    ...base,
    minHeight: 42,
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    '&:hover': { border: 'none', boxShadow: 'none' },
  }),
  valueContainer: (base) => ({ ...base, paddingLeft: 4 }),
  indicatorsContainer: (base) => ({ ...base, paddingRight: 4 }),
  menu: (base) => ({ ...base, zIndex: 60 }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
}

export function FormSelect({
  inputId,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  isDisabled,
  isClearable = false,
  isSearchable = true,
  embedded = false,
  'aria-label': ariaLabel,
}: FormSelectProps) {
  return (
    <Select<SelectOption, false>
      inputId={inputId}
      aria-label={ariaLabel}
      options={options}
      value={value}
      onChange={(v) => onChange(v)}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isClearable={isClearable}
      isSearchable={isSearchable}
      styles={embedded ? embeddedStyles : styles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
    />
  )
}
