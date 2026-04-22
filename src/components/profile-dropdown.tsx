import { Moon, LogOut } from 'lucide-react'
import useDialogState from '../hooks/use-dialog-state'
import { useScreenSize } from '../hooks/use-screen-size'
import { useTheme } from '../context/theme-provider'
import { readProfileCookie } from '../lib/profile-cookie'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './ui/drawer'
import { Switch } from './ui/switch'
import { SignOutDialog } from './sign-out-dialog'

export function ProfileDropdown() {
  const { isDesktop } = useScreenSize()
  const [open, setOpen] = useDialogState()
  const [dropdownOpen, setDropdownOpen] = useDialogState()
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  const profile = readProfileCookie()
  const displayName = profile.name || profile.email || ''
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

  const avatarButton = (
    <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
      <Avatar className='h-8 w-8'>
        <AvatarImage src='' alt={displayName} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
    </Button>
  )

  const userInfo = (
    <div className='flex flex-col gap-1.5'>
      {profile.name && <p className='text-sm leading-none font-medium'>{profile.name}</p>}
      {profile.email && <p className='text-muted-foreground text-xs leading-none'>{profile.email}</p>}
      {!profile.name && !profile.email && <p className='text-muted-foreground text-xs leading-none'>No profile</p>}
    </div>
  )

  const logoutButton = (
    <Button
      variant='ghost'
      className='w-full justify-start px-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive'
      onClick={() => setOpen(true)}
    >
      <LogOut size={16} className='mr-2 text-destructive' />
      Log out
    </Button>
  )

  if (isDesktop) {
    return (
      <>
        <DropdownMenu modal={false} open={!!dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>{avatarButton}</DropdownMenuTrigger>
          <DropdownMenuContent className='w-56' align='end' forceMount>
            <DropdownMenuLabel className='font-normal'>
              {userInfo}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <div className="flex items-center justify-between px-2 py-1.5 text-sm select-none">
              <div className="flex items-center gap-2">
                <Moon className="size-4" />
                Dark mode
              </div>
              <Switch 
                checked={isDark} 
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} 
              />
            </div>

            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setOpen(true)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut size={16} className='mr-2 text-destructive' />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <SignOutDialog open={!!open} onOpenChange={setOpen} />
      </>
    )
  }

  return (
    <>
      <Drawer open={!!dropdownOpen} onOpenChange={setDropdownOpen}>
        <DrawerTrigger asChild>{avatarButton}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className='sr-only'>Profile</DrawerTitle>
          </DrawerHeader>
          <div className='px-4 pb-4'>
            <div className='mb-4 pb-4 border-b'>{userInfo}</div>
            
            <div className='flex flex-col gap-2'>
              <div className="flex items-center justify-between px-2 py-1.5 text-sm hover:bg-muted rounded-md">
                <div className="flex items-center gap-2">
                  <Moon className="size-4" />
                  Dark mode
                </div>
                <Switch 
                  checked={isDark} 
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} 
                />
              </div>

              {logoutButton}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
