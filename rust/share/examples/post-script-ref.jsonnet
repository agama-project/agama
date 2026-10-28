{
  user: {
    fullName: 'Jane Doe',
    userName: 'jane.doe',
    password: 'nots3cr3t',
  },
  root: {
    password: 'nots3cr3t',
  },
  product: {
    id: 'Tumbleweed',
  },
  scripts: {
    post: [
      {
        name: 'enable-sshd',
        chroot: true,
        url: '../examples/enable-sshd.sh',
      },
    ],
  },
}
