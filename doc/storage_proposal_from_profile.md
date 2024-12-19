# Calculating a proposal from a profile

The Agama proposal can be calculated either from a very detailed JSON profile or from a "sparse
profile". The information not provided by the profile is automatically inferred (solved) by Agama.
Several layers are involved in the process of obtaining the final storage config used by the Agama
proposal, as shown in the following diagram:

```
JSON profile ------------> JSON profile (solved) ------------> Storage::Config ------------> Storage::Config (solved)
                   |                                   |                             |
             (JSON solver)                    (config conversion)              (config solver)
```

## JSON solver

The JSON profile provides the *generator* concept. A *generator* allows indicating what volumes to
create without explicitly defining them. The JSON solver (`Agama::Storage::JSONConfigSolver` class)
takes care of replacing the volume generator by the corresponding JSON volumes according to the
product.

For example, a JSON profile like this:

~~~json
{
  "drives": [
    {
      "partitions": [ { "generate": "default" } ]
    }
  ]
}
~~~

would be solved to something like:

~~~json
{
  "drives": [
    {
      "partitions": [
        { "filesystem": { "path": "/" } },
        { "filesystem": { "path": "swap" } }
      ]
    }
  ]
}
~~~

The volumes are solved with their very minimum information (i.e., a mount path). The resulting
solved JSON is used for getting the storage config object.

## Config conversion

The class `Agama::Storage::ConfigConversions::FromJSON` takes a solved JSON profile and generates a
`Agama::Storage::Config` object. The resulting config only contains the information provided by the
profile. For example, if the profile does not specify a file system type for a partition, then the
config would not have any information about the file system to use for such a partition.

If something is not provided by the profile (e.g., "boot", "size", "filesystem"), then the config
marks that values as default ones. For example:

```json
{
  "drives": [
    {
      "partitions": [
        { "filesystem": { "path": "/" } }
      ]
    }
  ]
}
```

generates a config with these default values:

```ruby
config.boot.device.default?                       #=> true

partition = config.drives.first.partitions.first
partition.size.default?                           #=> true
partition.filesystem.type.default?                #=> true
```

The configs set as default and any other missing value have to be solved to a value provided by the
product definition.

## Config solver

The config solver (`Agama::Storage::ConfigSolver` class) assigns a value to all the unknown
properties of a config object. As result, the config object is totally complete and ready to be used
by the agama proposal.

### How sizes are solved

A volume size in the profile:

* Can be totally omitted.
* Can omit the max size.
* Can use "current" as value for min and/or max.

Let's see each case.

#### Omitting size completely

```json
"partitions": [
  { "filesystem": { "path": "/" } }
]
```

In this case, the config conversion would generate something like:

```ruby
partition.size.default? #=> true
partition.size.min      #=> nil
partition.size.max      #=> nil
```

If the size is default, then the config solver always assigns a value for `#min` and `#max`
according to the product definition and ignoring the current values assigned to `#min` and `#max`.
The solver takes into account the mount path, the fallback devices and swap config in order to set
the proper sizes.

If the size is default and the volume already exists, then the solver sets the current size of the
volume to both `#min` and `#max` sizes.

#### Omitting the max size

```json
"partitions": [
  {
    "size": { "min": "10 GiB" },
    "filesystem": { "path": "/" }
  }
]
```

The config conversion generates:

```ruby
partition.size.default? #=> false
partition.size.min      #=> Y2Storage::DiskSize.GiB(10)
partition.size.max      #=> Y2Storage::DiskSize.Unlimited
```

Note that `#max` is set to unlimited when it does not appear in the profile. In this case, nothing
has to be solved because both `#min` and `#max` have a value.

#### Using "current"

Both *min* and *max* sizes admit "current" as a valid size value in the JSON profile. The "current"
value stands for the current size of the volume. Using "current" is useful for growing or shrinking
a device.

The config conversion knows nothing about the current size of a volume, so it simply replaces
"current" values by `nil`.

For example, in this case:

```json
"partitions": [
  {
    "search": "/dev/vda1",
    "size": { "min": "current" },
    "filesystem": { "path": "/" }
  }
]
```

the config conversion generates a size with `nil` for `#min`:

```ruby
partition.size.default? #=> false
partition.size.min      #=> nil
partition.size.max      #=> Y2Storage::DiskSize.Unlimited
```

The config solver replaces the `nil` sizes by the device size. In the example before, let's say that
/dev/vda1 has 10 GiB, so the resulting config would be:

```ruby
partition.size.default? #=> false
partition.size.min      #=> Y2Storage::DiskSize.GiB(10)
partition.size.max      #=> Y2Storage::DiskSize.Unlimited
```

##### Use case: growing a device

```json
"partitions": [
  {
    "search": "/dev/vda1",
    "size": { "min": "current" },
    "filesystem": { "path": "/" }
  }
]
```

```ruby
partition.size.default? #=> false
partition.size.min      #=> Y2Storage::DiskSize.GiB(10)
partition.size.max      #=> Y2Storage::DiskSize.Unlimited
```

##### Use case: shrinking a device

```json
"partitions": [
  {
    "search": "/dev/vda1",
    "size": { "min": 0, "max": "current" },
    "filesystem": { "path": "/" }
  }
]
```

```ruby
partition.size.default? #=> false
partition.size.min      #=> 0
partition.size.max      #=> Y2Storage::DiskSize.GiB(10)
```

##### Use case: keeping a device size

Note that this is equivalent to omitting the size.

```json
"partitions": [
  {
    "search": "/dev/vda1",
    "size": { "min": "current", "max": "current" },
    "filesystem": { "path": "/" }
  }
]
```

```ruby
partition.size.default? #=> false
partition.size.min      #=> Y2Storage::DiskSize.GiB(10)
partition.size.max      #=> Y2Storage::DiskSize.GiB(10)
```

##### Use case: fallback for not found devices

A profile can specify an "advanced search" to indicate that a volume has to be created if it is not
found in the system.

```json
"partitions": [
  {
    "search": {
      "condition": { "name": "/dev/vda1" },
      "ifNotFound": "create"
    },
    "size": { "min": "current" },
    "filesystem": { "path": "/" }
  }
]
```

If the device does not exist, then "current" cannot be replaced by any device size. In this case,
the config solver uses the default size defined by the product as fallback for "current".

```ruby
partition.size.default? #=> false
partition.size.min      #=> Y2Storage::DiskSize.GiB(15)
partition.size.max      #=> Y2Storage::DiskSize.Unlimited
```
